// Debounced autosave shared by the note pad and spreadsheet editors.
// Waits `delay` ms after the last edit, then PATCHes `body()` (a FormData) to `url`,
// showing editing/saving/saved/error/offline in the optional status element.
const LABELS = {
  editing: "editing…",
  saving: "saving…",
  saved: "saved",
  error: "error saving",
  offline: "offline — will retry"
}

export class Autosave {
  constructor({ url, body, status = null, delay = 600 }) {
    this.url = url
    this.body = body
    this.status = status
    this.delay = delay
    this.timeout = null
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

    try {
      const response = await fetch(this.url, {
        method: "PATCH",
        headers: {
          "X-CSRF-Token": document.querySelector('meta[name="csrf-token"]').content,
          "Accept": "text/vnd.turbo-stream.html"
        },
        body: this.body(),
        keepalive
      })

      this.setStatus(response.ok ? "saved" : "error")
    } catch (e) {
      // fetch throws on network failure — the offline outbox will plug in here
      this.setStatus("offline")
    }
  }

  setStatus(state) {
    if (!this.status) return
    this.status.textContent = LABELS[state]
    this.status.dataset.state = state
  }
}
