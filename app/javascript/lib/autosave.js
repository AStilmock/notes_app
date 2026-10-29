import { outbox } from "lib/outbox"

// Debounced autosave shared by the note pad and spreadsheet editors.
// Waits `delay` ms after the last edit, then PATCHes `body()` (a FormData) to `url`,
// showing the state in the optional status element.
//
// Offline: a save that can't reach the server goes into the outbox (IndexedDB) and is
// replayed when the browser comes back online or on the next page load. If an editor opens
// with a queued edit for its URL (e.g. from a cached page), `restore(fields)` puts it back.
const LABELS = {
  editing: () => "editing…",
  saving: () => "saving…",
  saved: () => "saved",
  error: () => "error saving",
  offline: (queued) => `offline — ${queued || 1} edit${queued > 1 ? "s" : ""} queued`,
  signedOut: () => "signed out — log in to sync"
}

const LOGIN_PATH = "/session/new"

export class Autosave {
  constructor({ url, body, restore = null, status = null, delay = 600 }) {
    this.url = url
    this.body = body
    this.status = status
    this.delay = delay
    this.timeout = null

    this.onFlushed = (event) => { if (event.detail.url === this.url) this.setStatus("saved") }
    window.addEventListener("autosave:flushed", this.onFlushed)

    if (restore) this.#resume(restore)
  }

  disconnect() {
    window.removeEventListener("autosave:flushed", this.onFlushed)
    this.flush()
  }

  schedule() {
    this.setStatus("editing")
    clearTimeout(this.timeout)
    this.timeout = setTimeout(() => {
      this.timeout = null
      this.save()
    }, this.delay)
  }

  // save any pending edit now; keepalive lets the request finish after the page is gone
  flush() {
    if (!this.timeout) return
    clearTimeout(this.timeout)
    this.timeout = null
    this.save({ keepalive: true })
  }

  async save({ keepalive = false } = {}) {
    this.setStatus("saving")
    const body = this.body()

    let response
    try {
      response = await patch(this.url, body, { keepalive })
    } catch (e) {
      // network failure (or a keepalive body over the browser's 64KB limit)
      await this.#queue(body)
      this.setStatus("offline", await safely(() => outbox.count(), 1))
      return
    }

    if (response.status === 401) {
      // session expired: keep the edit, send them to log in, and it syncs afterwards
      await this.#queue(body)
      this.setStatus("signedOut")
      if (!keepalive) window.location.assign(LOGIN_PATH)
    } else if (response.ok) {
      await safely(() => outbox.delete(this.url))
      this.setStatus("saved")
      flushOutbox()
    } else {
      this.setStatus("error")
    }
  }

  setStatus(state, count) {
    if (!this.status) return
    this.status.textContent = LABELS[state](count)
    this.status.dataset.state = state
  }

  async #queue(body) {
    await safely(() => outbox.put(this.url, [...body.entries()]))
  }

  async #resume(restore) {
    const entry = await safely(() => outbox.get(this.url))
    if (!entry) return
    restore(Object.fromEntries(entry.fields))
    this.setStatus("offline", await safely(() => outbox.count(), 1))
    flushOutbox()
  }
}

// Replays queued edits, oldest first. Stops at the first network failure (still offline)
// or 401 (needs login). Anything else — saved, or rejected for good — leaves the outbox.
let flushing = null

export function flushOutbox() {
  flushing ||= replay().finally(() => { flushing = null })
  return flushing
}

async function replay() {
  const entries = await safely(() => outbox.all(), [])
  entries.sort((a, b) => a.queuedAt - b.queuedAt)

  for (const { url, fields, queuedAt } of entries) {
    let response
    try {
      response = await patch(url, toFormData(fields))
    } catch (e) {
      return
    }
    if (response.status === 401) return

    await safely(() => outbox.delete(url, queuedAt))
    if (response.ok) window.dispatchEvent(new CustomEvent("autosave:flushed", { detail: { url } }))
  }
}

function patch(url, body, { keepalive = false } = {}) {
  return fetch(url, {
    method: "PATCH",
    headers: {
      "X-CSRF-Token": document.querySelector('meta[name="csrf-token"]')?.content,
      "Accept": "text/vnd.turbo-stream.html"
    },
    body,
    keepalive
  })
}

function toFormData(fields) {
  const body = new FormData()
  fields.forEach(([name, value]) => body.append(name, value))
  return body
}

// IndexedDB can be unavailable (some private modes); autosave still works without the outbox
async function safely(work, fallback = undefined) {
  try {
    return await work()
  } catch (e) {
    return fallback
  }
}

// retry when the connection returns, and on every page load (including Turbo visits,
// e.g. landing back in the app after logging in again)
window.addEventListener("online", () => flushOutbox())
document.addEventListener("turbo:load", () => flushOutbox())
