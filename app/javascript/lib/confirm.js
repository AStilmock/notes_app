// DOS-styled replacement for window.confirm, used by data-turbo-confirm.
// Resolves true on [Y]es, false on [N]o / Esc / backdrop.
export function confirmDialog(message) {
  const dialog = document.getElementById("confirm_dialog")
  if (!dialog) return Promise.resolve(window.confirm(message))

  dialog.querySelector("[data-confirm-message]").textContent = message
  dialog.returnValue = ""

  const onKey = (event) => {
    const key = event.key.toLowerCase()
    if (key === "y") dialog.close("yes")
    if (key === "n") dialog.close("no")
  }
  dialog.addEventListener("keydown", onKey)
  dialog.showModal()

  return new Promise((resolve) => {
    dialog.addEventListener("close", () => {
      dialog.removeEventListener("keydown", onKey)
      resolve(dialog.returnValue === "yes")
    }, { once: true })
  })
}
