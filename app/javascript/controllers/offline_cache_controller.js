import { Controller } from "@hotwired/stimulus"

// Deletes the service worker's cached pages (they hold a signed-in user's notes).
// Used on logout, and on the login page in case the session ended some other way.
// Queued offline edits are kept: they can only be saved by the same user logging back in.
export default class extends Controller {
  static values = { clearOnConnect: Boolean }

  connect() {
    if (this.clearOnConnectValue) this.clear()
  }

  async clear() {
    if (!("caches" in window)) return
    const keys = await caches.keys()
    await Promise.all(keys.filter((key) => key.startsWith("pages-")).map((key) => caches.delete(key)))
  }
}
