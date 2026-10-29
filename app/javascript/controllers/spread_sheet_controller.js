import { Controller } from "@hotwired/stimulus"
import { Autosave } from "lib/autosave"

// Editable grid of text cells. Keeps the grid in this.cells (an array of rows),
// draws it into the <table> target, and autosaves title + cells (as JSON) on every change.
export default class extends Controller {
  static targets = ["title", "grid", "status"]
  static values = {
    url: String,
    cells: Array,
    maxRows: { type: Number, default: 100 },
    maxCols: { type: Number, default: 26 },
    debounce: { type: Number, default: 600 }
  }

  connect() {
    this.cells = this.cellsValue.map((row) => [...row])
    this.selected = { row: 0, col: 0 }
    this.autosave = new Autosave({
      url: this.urlValue,
      delay: this.debounceValue,
      status: this.hasStatusTarget ? this.statusTarget : null,
      restore: (fields) => {
        this.titleTarget.value = fields["spread_sheet[title]"] ?? this.titleTarget.value
        if (fields["spread_sheet[cells]"]) {
          this.cells = JSON.parse(fields["spread_sheet[cells]"])
          this.render()
        }
      },
      body: () => {
        const body = new FormData()
        body.append("spread_sheet[title]", this.titleTarget.value)
        body.append("spread_sheet[cells]", JSON.stringify(this.cells))
        return body
      }
    })
    this.render()
  }

  disconnect() {
    this.autosave.disconnect()
  }

  scheduleSave() {
    this.autosave.schedule()
  }

  // rows / columns are added at the end; removal takes the selected row / column

  addRow() {
    if (this.cells.length >= this.maxRowsValue) return
    this.cells.push(Array(this.#colCount).fill(""))
    this.#changed({ row: this.cells.length - 1, col: this.selected.col })
  }

  addColumn() {
    if (this.#colCount >= this.maxColsValue) return
    this.cells.forEach((row) => row.push(""))
    this.#changed({ row: this.selected.row, col: this.#colCount - 1 })
  }

  removeRow() {
    if (this.cells.length <= 1) return
    this.cells.splice(this.selected.row, 1)
    this.#changed(this.selected)
  }

  removeColumn() {
    if (this.#colCount <= 1) return
    this.cells.forEach((row) => row.splice(this.selected.col, 1))
    this.#changed(this.selected)
  }

  render() {
    const table = this.gridTarget
    table.replaceChildren()

    const head = table.createTHead().insertRow()
    head.appendChild(document.createElement("th"))
    for (let col = 0; col < this.#colCount; col++) {
      const th = document.createElement("th")
      th.scope = "col"
      th.textContent = columnName(col)
      head.appendChild(th)
    }

    const body = table.createTBody()
    this.cells.forEach((cells, row) => {
      const tr = body.insertRow()
      const th = document.createElement("th")
      th.scope = "row"
      th.textContent = row + 1
      tr.appendChild(th)

      cells.forEach((value, col) => {
        const input = document.createElement("input")
        input.type = "text"
        input.value = value
        input.dataset.row = row
        input.dataset.col = col
        input.setAttribute("aria-label", `${columnName(col)}${row + 1}`)
        input.addEventListener("input", () => this.#edit(row, col, input.value))
        input.addEventListener("focus", () => this.#select(row, col))
        input.addEventListener("keydown", (event) => this.#navigate(event, row, col))
        tr.insertCell().appendChild(input)
      })
    })

    this.#highlightHeaders()
  }

  get #colCount() {
    return this.cells[0].length
  }

  #edit(row, col, value) {
    this.cells[row][col] = value
    this.scheduleSave()
  }

  #changed({ row, col }) {
    this.render()
    this.#focus(row, col)
    this.scheduleSave()
  }

  #select(row, col) {
    this.selected = { row, col }
    this.#highlightHeaders()
  }

  #focus(row, col) {
    row = Math.min(Math.max(row, 0), this.cells.length - 1)
    col = Math.min(Math.max(col, 0), this.#colCount - 1)
    this.gridTarget.querySelector(`input[data-row="${row}"][data-col="${col}"]`)?.focus()
  }

  // arrows move between cells (left/right only at the edge of the text); Enter moves down
  #navigate(event, row, col) {
    const input = event.target
    const atStart = input.selectionStart === 0 && input.selectionEnd === 0
    const atEnd = input.selectionStart === input.value.length

    const moves = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      Enter: [event.shiftKey ? -1 : 1, 0],
      ArrowLeft: atStart ? [0, -1] : null,
      ArrowRight: atEnd ? [0, 1] : null
    }
    const move = moves[event.key]
    if (!move) return

    event.preventDefault()
    this.#focus(row + move[0], col + move[1])
  }

  #highlightHeaders() {
    const { row, col } = this.selected
    this.gridTarget.querySelectorAll("th[data-active]").forEach((th) => delete th.dataset.active)
    this.gridTarget.tHead?.rows[0].cells[col + 1]?.setAttribute("data-active", "")
    this.gridTarget.tBodies[0]?.rows[row]?.cells[0]?.setAttribute("data-active", "")
  }
}

// 0 → A, 25 → Z
function columnName(index) {
  return String.fromCharCode(65 + index)
}
