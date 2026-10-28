import { Controller } from "@hotwired/stimulus"
import { Autosave } from "lib/autosave"

// Debounced autosave for a note pad's title and body, with a status indicator.
export default class extends Controller {
  static targets = ["title", "body", "status"]
  static values = { url: String, debounce: { type: Number, default: 600 } }

  connect() {
    this.autosave = new Autosave({
      url: this.urlValue,
      delay: this.debounceValue,
      status: this.hasStatusTarget ? this.statusTarget : null,
      body: () => {
        const body = new FormData()
        body.append("note_pad[title]", this.titleTarget.value)
        body.append("note_pad[body]", this.bodyTarget.value)
        return body
      }
    })
  }

  // flush any pending edit if the user navigates away mid-type
  disconnect() {
    this.autosave.flush()
  }

  // called by data-action on input events for both title and body
  scheduleSave() {
    this.autosave.schedule()
  }
}
