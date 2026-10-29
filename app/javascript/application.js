// Configure your import map in config/importmap.rb. Read more: https://github.com/rails/importmap-rails
import { Turbo } from "@hotwired/turbo-rails"
import "controllers"
import { confirmDialog } from "lib/confirm"

Turbo.config.forms.confirm = confirmDialog

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/service-worker.js", { scope: "/" })
}
