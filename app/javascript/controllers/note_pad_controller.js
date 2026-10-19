import { Controller } from "@hotwired/stimulus"

// Debounced autosave for a note pad's title and body, with a status indicator.
export default class extends Controller {
  static targets = ["title", "body", "status"]
  static values = { url: String, debounce: { type: Number, default: 600 } }

  connect() {
    this.timeout = null
  }

  disconnect() {
    // flush any pending edit immediately if the user navigates away mid-type;
    // keepalive lets the request finish after the page is gone
    if (this.timeout) {
      clearTimeout(this.timeout)
      this.timeout = null
      this.save({ keepalive: true })
    }
  }

  // called by data-action on input events for both title and body
  scheduleSave() {
    this.#setStatus("editing")
    clearTimeout(this.timeout)
    this.timeout = setTimeout(() => {
      this.timeout = null
      this.save()
    }, this.debounceValue)
  }

  async save({ keepalive = false } = {}) {
    this.#setStatus("saving")

    const body = new FormData()
    body.append("note_pad[title]", this.titleTarget.value)
    body.append("note_pad[body]", this.bodyTarget.value)

    try {
      const response = await fetch(this.urlValue, {
        method: "PATCH",
        headers: {
          "X-CSRF-Token": document.querySelector('meta[name="csrf-token"]').content,
          "Accept": "text/vnd.turbo-stream.html"
        },
        body,
        keepalive
      })

      this.#setStatus(response.ok ? "saved" : "error")
    } catch (e) {
      // fetch throws on network failure — the offline outbox will plug in here
      this.#setStatus("offline")
    }
  }

  #setStatus(state) {
    if (!this.hasStatusTarget) return
    this.statusTarget.textContent = {
      editing: "editing…",
      saving: "saving…",
      saved: "saved",
      error: "error saving",
      offline: "offline — will retry"
    }[state]
    this.statusTarget.dataset.state = state
  }
}
