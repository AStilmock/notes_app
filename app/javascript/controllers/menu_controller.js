import { Controller } from "@hotwired/stimulus"
import { Turbo } from "@hotwired/turbo-rails"

// Menu bar: F-key / Alt+letter shortcuts, plus the collapsed menu on small screens.
// Links declare their own shortcuts with data-menu-key="F1" and data-menu-alt="n".
export default class extends Controller {
  static targets = ["list", "toggle"]

  // shortcuts work even while typing in a pad: F-keys and Alt+letter never insert text
  shortcut(event) {
    const link = this.#linkFor(event)
    if (!link) return
    event.preventDefault()
    this.close()
    Turbo.visit(link.href)
  }

  toggle() {
    const open = this.listTarget.classList.toggle("hidden") === false
    this.toggleTarget.setAttribute("aria-expanded", open)
  }

  close() {
    if (!this.hasToggleTarget) return
    this.listTarget.classList.add("hidden")
    this.toggleTarget.setAttribute("aria-expanded", false)
  }

  #linkFor(event) {
    const links = this.element.querySelectorAll("a[data-menu-key]")
    return Array.from(links).find((link) => {
      if (event.key === link.dataset.menuKey) return true
      // event.code, because Alt+N on a Mac produces "˜" as event.key
      return event.altKey && event.code === `Key${link.dataset.menuAlt.toUpperCase()}`
    })
  }
}
