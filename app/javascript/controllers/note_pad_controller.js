import { Controller } from "@hotwired/stimulus"
import { Autosave } from "lib/autosave"

// Debounced autosave for a note pad's title and rich-text body, with a status indicator.
// The body is a contenteditable div; the toolbar buttons format the selection with
// execCommand (b / i / u / strike / ul tags, which NotePad's sanitizer allows).
export default class extends Controller {
  static targets = ["title", "body", "status", "formatButton"]
  static values = { url: String, debounce: { type: Number, default: 600 } }

  connect() {
    this.autosave = new Autosave({
      url: this.urlValue,
      delay: this.debounceValue,
      status: this.hasStatusTarget ? this.statusTarget : null,
      restore: (fields) => {
        this.titleTarget.value = fields["note_pad[title]"] ?? this.titleTarget.value
        this.bodyTarget.innerHTML = fields["note_pad[body]"] ?? this.bodyTarget.innerHTML
        this.#updatePlaceholder()
      },
      body: () => {
        const body = new FormData()
        body.append("note_pad[title]", this.titleTarget.value)
        body.append("note_pad[body]", this.bodyTarget.innerHTML)
        return body
      }
    })

    this.selectionChanged = () => this.#updateToolbar()
    document.addEventListener("selectionchange", this.selectionChanged)
    this.#updatePlaceholder()
  }

  // flush any pending edit if the user navigates away mid-type
  disconnect() {
    document.removeEventListener("selectionchange", this.selectionChanged)
    this.autosave.disconnect()
  }

  // called by data-action on input events for both title and body
  scheduleSave() {
    this.#updatePlaceholder()
    this.autosave.schedule()
  }

  // toolbar buttons: mousedown would move focus out of the body and lose the selection
  keepSelection(event) {
    event.preventDefault()
  }

  // data-note-pad-command-param is an execCommand name: bold, italic, underline, strikeThrough, ...
  format({ params: { command } }) {
    if (!this.bodyTarget.contains(document.activeElement)) this.bodyTarget.focus()
    document.execCommand("styleWithCSS", false, false) // tags (<b>), not style attributes
    document.execCommand(command)
    this.#updateToolbar()
    this.scheduleSave()
  }

  // Ctrl/Cmd+B, I and U are built into contenteditable; this adds Ctrl/Cmd+Shift+X for strikethrough
  shortcut(event) {
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "x") {
      event.preventDefault()
      this.format({ params: { command: "strikeThrough" } })
    }
  }

  // paste as plain text, so formatting (and markup) from other pages doesn't come along
  paste(event) {
    event.preventDefault()
    document.execCommand("insertText", false, event.clipboardData.getData("text/plain"))
  }

  // buttons show as pressed while the caret / selection has that formatting
  #updateToolbar() {
    if (!this.bodyTarget.contains(document.getSelection()?.anchorNode)) return

    this.formatButtonTargets.forEach((button) => {
      if (button.hasAttribute("aria-pressed")) {
        button.setAttribute("aria-pressed", document.queryCommandState(button.dataset.notePadCommandParam))
      }
    })
  }

  #updatePlaceholder() {
    const empty = this.bodyTarget.textContent.trim() === "" && !this.bodyTarget.querySelector("li")
    this.bodyTarget.toggleAttribute("data-empty", empty)
  }
}
