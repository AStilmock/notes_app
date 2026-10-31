import { Controller } from "@hotwired/stimulus"
import { Autosave } from "lib/autosave"

const DEFAULT_WIDTH = 144 // px, a column nobody has resized
const ROW_HEADER_WIDTH = 48
const FIT_MIN_WIDTH = 64 // "fit" never shrinks a column below room to type in
const CELL_PADDING_X = 18 // input's left + right padding, plus a little room for the caret

// Editable grid of text cells. Keeps the grid in this.cells (an array of rows) and the
// column widths / row heights in this.colWidths / this.rowHeights (px, null = default),
// draws it into the <table> target, and autosaves everything (as JSON) on every change.
//
// Resizing: drag the right edge of a column header or the bottom edge of a row number.
// Double-click a column edge (or press FIT) to fit columns to their text; double-click a
// row edge to reset its height. Text doesn't wrap: a cell shows one line.
export default class extends Controller {
  static targets = ["title", "grid", "status"]
  static values = {
    url: String,
    cells: Array,
    colWidths: Array,
    rowHeights: Array,
    widthRange: { type: Array, default: [48, 1600] },
    heightRange: { type: Array, default: [24, 320] },
    maxRows: { type: Number, default: 100 },
    maxCols: { type: Number, default: 26 },
    debounce: { type: Number, default: 600 }
  }

  connect() {
    this.cells = this.cellsValue.map((row) => [...row])
    this.#loadSizes(this.colWidthsValue, this.rowHeightsValue)
    this.selected = { row: 0, col: 0 }
    this.autosave = new Autosave({
      url: this.urlValue,
      delay: this.debounceValue,
      status: this.hasStatusTarget ? this.statusTarget : null,
      restore: (fields) => {
        this.titleTarget.value = fields["spread_sheet[title]"] ?? this.titleTarget.value
        if (fields["spread_sheet[cells]"]) {
          this.cells = JSON.parse(fields["spread_sheet[cells]"])
          this.#loadSizes(JSON.parse(fields["spread_sheet[col_widths]"] || "[]"),
                          JSON.parse(fields["spread_sheet[row_heights]"] || "[]"))
          this.render()
        }
      },
      body: () => {
        const body = new FormData()
        body.append("spread_sheet[title]", this.titleTarget.value)
        body.append("spread_sheet[cells]", JSON.stringify(this.cells))
        body.append("spread_sheet[col_widths]", JSON.stringify(this.colWidths))
        body.append("spread_sheet[row_heights]", JSON.stringify(this.rowHeights))
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
    this.rowHeights.push(null)
    this.#changed({ row: this.cells.length - 1, col: this.selected.col })
  }

  addColumn() {
    if (this.#colCount >= this.maxColsValue) return
    this.cells.forEach((row) => row.push(""))
    this.colWidths.push(null)
    this.#changed({ row: this.selected.row, col: this.#colCount - 1 })
  }

  removeRow() {
    if (this.cells.length <= 1) return
    this.cells.splice(this.selected.row, 1)
    this.rowHeights.splice(this.selected.row, 1)
    this.#changed(this.selected)
  }

  removeColumn() {
    if (this.#colCount <= 1) return
    this.cells.forEach((row) => row.splice(this.selected.col, 1))
    this.colWidths.splice(this.selected.col, 1)
    this.#changed(this.selected)
  }

  // FIT button: every column as wide as its longest text
  fitAllColumns() {
    for (let col = 0; col < this.#colCount; col++) this.#fitColumn(col)
    this.scheduleSave()
  }

  render() {
    const table = this.gridTarget
    table.replaceChildren()

    // fixed table layout: the <col> widths are the column widths, whatever the text
    const colgroup = document.createElement("colgroup")
    colgroup.appendChild(sizedCol(ROW_HEADER_WIDTH))
    for (let col = 0; col < this.#colCount; col++) colgroup.appendChild(sizedCol(this.#widthOf(col)))
    table.appendChild(colgroup)
    this.#updateTableWidth()

    const head = table.createTHead().insertRow()
    head.appendChild(document.createElement("th"))
    for (let col = 0; col < this.#colCount; col++) {
      const th = document.createElement("th")
      th.scope = "col"
      th.textContent = columnName(col)
      th.appendChild(this.#resizeHandle("col", col))
      head.appendChild(th)
    }

    const body = table.createTBody()
    this.cells.forEach((cells, row) => {
      const tr = body.insertRow()
      const th = document.createElement("th")
      th.scope = "row"
      th.textContent = row + 1
      th.appendChild(this.#resizeHandle("row", row))
      tr.appendChild(th)

      cells.forEach((value, col) => {
        const input = document.createElement("input")
        input.type = "text"
        input.value = value
        input.dataset.row = row
        input.dataset.col = col
        input.setAttribute("aria-label", `${columnName(col)}${row + 1}`)
        if (this.rowHeights[row]) input.style.height = `${this.rowHeights[row]}px`
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

  // one entry per column / row, padded with null (default size) and trimmed to the grid
  #loadSizes(colWidths, rowHeights) {
    this.colWidths = Array.from({ length: this.#colCount }, (_, col) => colWidths[col] ?? null)
    this.rowHeights = Array.from({ length: this.cells.length }, (_, row) => rowHeights[row] ?? null)
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
    this.#input(row, col)?.focus()
  }

  #input(row, col) {
    return this.gridTarget.querySelector(`input[data-row="${row}"][data-col="${col}"]`)
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

  // --- resizing ---

  #resizeHandle(axis, index) {
    const handle = document.createElement("span")
    handle.className = axis === "col" ? "sheet-resize-col" : "sheet-resize-row"
    handle.setAttribute("aria-hidden", "true")
    handle.title = axis === "col" ? "Drag to resize · double-click to fit text" : "Drag to resize · double-click to reset"
    handle.addEventListener("pointerdown", (event) => this.#startResize(event, axis, index))
    handle.addEventListener("dblclick", () => {
      if (axis === "col") {
        this.#fitColumn(index)
      } else {
        this.#setRowHeight(index, null)
      }
      this.scheduleSave()
    })
    return handle
  }

  #startResize(event, axis, index) {
    if (event.button !== 0) return
    event.preventDefault()

    const handle = event.currentTarget
    handle.setPointerCapture(event.pointerId)
    handle.dataset.resizing = ""

    const position = (e) => (axis === "col" ? e.clientX : e.clientY)
    const start = position(event)
    const initial = axis === "col" ? this.#widthOf(index) : this.#heightOf(index)
    let resized = false

    const move = (e) => {
      const size = initial + position(e) - start
      if (axis === "col") {
        this.#setColWidth(index, clamp(size, this.widthRangeValue))
      } else {
        this.#setRowHeight(index, clamp(size, this.heightRangeValue))
      }
      resized = true
    }
    const end = () => {
      handle.removeEventListener("pointermove", move)
      handle.removeEventListener("pointerup", end)
      handle.removeEventListener("pointercancel", end)
      delete handle.dataset.resizing
      if (resized) this.scheduleSave()
    }

    handle.addEventListener("pointermove", move)
    handle.addEventListener("pointerup", end)
    handle.addEventListener("pointercancel", end)
  }

  #widthOf(col) {
    return this.colWidths[col] ?? DEFAULT_WIDTH
  }

  #heightOf(row) {
    return this.rowHeights[row] ?? this.#input(row, 0)?.offsetHeight ?? this.heightRangeValue[0]
  }

  #setColWidth(col, width) {
    this.colWidths[col] = width
    const colEl = this.gridTarget.querySelectorAll("col")[col + 1]
    if (colEl) colEl.style.width = `${width}px`
    this.#updateTableWidth()
  }

  #setRowHeight(row, height) {
    this.rowHeights[row] = height
    this.gridTarget.querySelectorAll(`input[data-row="${row}"]`).forEach((input) => {
      input.style.height = height ? `${height}px` : ""
    })
  }

  #updateTableWidth() {
    const total = ROW_HEADER_WIDTH + this.colWidths.reduce((sum, _, col) => sum + this.#widthOf(col), 0)
    this.gridTarget.style.width = `${total}px`
  }

  // as wide as the column's longest text, measured in the cells' own font
  #fitColumn(col) {
    const input = this.#input(0, col)
    if (!input) return

    this.measure ||= document.createElement("canvas").getContext("2d")
    this.measure.font = getComputedStyle(input).font
    const widest = Math.max(0, ...this.cells.map((row) => this.measure.measureText(row[col]).width))
    const [min, max] = this.widthRangeValue
    this.#setColWidth(col, clamp(Math.ceil(widest + CELL_PADDING_X), [Math.max(min, FIT_MIN_WIDTH), max]))
  }
}

// 0 → A, 25 → Z
function columnName(index) {
  return String.fromCharCode(65 + index)
}

function sizedCol(width) {
  const col = document.createElement("col")
  col.style.width = `${width}px`
  return col
}

function clamp(value, [min, max]) {
  return Math.min(Math.max(Math.round(value), min), max)
}
