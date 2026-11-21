import { Controller } from "@hotwired/stimulus"
import { Autosave } from "lib/autosave"

const DEFAULT_WIDTH = 144 // px, a column nobody has resized
const ROW_HEADER_WIDTH = 48
const FIT_MIN_WIDTH = 64 // "fit" never shrinks a column below room to type in
const CELL_PADDING_X = 18 // input's left + right padding, plus a little room for the caret

// Editable grid of text cells. Keeps the grid in this.cells (an array of rows), each cell's
// formatting in this.formats (same shape; a string of flags: b i u s), and the column widths /
// row heights in this.colWidths / this.rowHeights (px, null = default), draws it into the
// <table> target, and autosaves everything (as JSON) on every change.
//
// Selection: a rectangle from this.anchor (the focused cell, where typing goes) to this.corner.
// Drag across cells, Shift+click or Shift+arrows to extend it; click a column letter or row
// number to take the whole column / row. Formatting, Delete and − ROW / − COL act on all of it.
//
// Copy / cut / paste: the selection goes to the clipboard as tab-separated rows (what Excel and
// Google Sheets use), and a pasted block lands at the selection's top-left, growing the grid to fit.
// A single value pasted into a multi-cell selection fills every selected cell.
//
// Resizing: drag the right edge of a column header or the bottom edge of a row number.
// Double-click a column edge (or press FIT) to fit columns to their text; double-click a
// row edge to reset its height. Text doesn't wrap: a cell shows one line.
export default class extends Controller {
  static targets = ["title", "grid", "status", "formatButton"]
  static values = {
    url: String,
    cells: Array,
    formats: Array,
    colWidths: Array,
    rowHeights: Array,
    widthRange: { type: Array, default: [48, 1600] },
    heightRange: { type: Array, default: [24, 320] },
    maxRows: { type: Number, default: 100 },
    maxCols: { type: Number, default: 26 },
    maxCellLength: { type: Number, default: 1000 },
    debounce: { type: Number, default: 600 }
  }

  connect() {
    this.cells = this.cellsValue.map((row) => [...row])
    this.#loadSizes(this.colWidthsValue, this.rowHeightsValue)
    this.#loadFormats(this.formatsValue)
    this.anchor = { row: 0, col: 0 }
    this.corner = { row: 0, col: 0 }
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
          this.#loadFormats(JSON.parse(fields["spread_sheet[formats]"] || "[]"))
          this.render()
        }
      },
      body: () => {
        const body = new FormData()
        body.append("spread_sheet[title]", this.titleTarget.value)
        body.append("spread_sheet[cells]", JSON.stringify(this.cells))
        body.append("spread_sheet[col_widths]", JSON.stringify(this.colWidths))
        body.append("spread_sheet[row_heights]", JSON.stringify(this.rowHeights))
        body.append("spread_sheet[formats]", JSON.stringify(this.formats))
        return body
      }
    })

    // drag-to-select: started by a cell's pointerdown, extended as the pointer crosses cells
    this.dragExtend = (event) => this.#dragOver(event)
    this.dragEnd = () => { this.dragging = false }
    this.gridTarget.addEventListener("pointerover", this.dragExtend)
    window.addEventListener("pointerup", this.dragEnd)

    this.clipboardHandlers = {
      copy: (event) => this.#copy(event),
      cut: (event) => { if (this.#copy(event)) this.#clearSelected() },
      paste: (event) => this.#paste(event)
    }
    Object.entries(this.clipboardHandlers).forEach(([type, handler]) => this.gridTarget.addEventListener(type, handler))
    this.render()
  }

  disconnect() {
    this.gridTarget.removeEventListener("pointerover", this.dragExtend)
    window.removeEventListener("pointerup", this.dragEnd)
    Object.entries(this.clipboardHandlers).forEach(([type, handler]) => this.gridTarget.removeEventListener(type, handler))
    this.autosave.disconnect()
  }

  scheduleSave() {
    this.autosave.schedule()
  }

  // rows / columns are added at the end; removal takes the selected rows / columns
  // (never all of them: a sheet keeps at least one row and one column)

  addRow() {
    if (!this.#appendRow()) return
    this.#changed({ row: this.cells.length - 1, col: this.anchor.col })
  }

  addColumn() {
    if (!this.#appendColumn()) return
    this.#changed({ row: this.anchor.row, col: this.#colCount - 1 })
  }

  removeRow() {
    const { top, bottom } = this.#range
    const count = bottom - top + 1
    if (count >= this.cells.length) return
    this.cells.splice(top, count)
    this.formats.splice(top, count)
    this.rowHeights.splice(top, count)
    this.#changed({ row: top, col: this.anchor.col })
  }

  removeColumn() {
    const { left, right } = this.#range
    const count = right - left + 1
    if (count >= this.#colCount) return
    this.cells.forEach((row) => row.splice(left, count))
    this.formats.forEach((row) => row.splice(left, count))
    this.colWidths.splice(left, count)
    this.#changed({ row: this.anchor.row, col: left })
  }

  // --- formatting (toolbar buttons and Ctrl/Cmd+B / I / U, Ctrl/Cmd+Shift+X) ---

  // toolbar buttons: mousedown would take focus out of the cell
  keepFocus(event) {
    event.preventDefault()
  }

  // data-spread-sheet-flag-param: b, i, u or s. On if any selected cell lacks it, else off.
  format({ params: { flag } }) {
    const cells = this.#selectedCells()
    const on = !cells.every(({ row, col }) => this.formats[row][col].includes(flag))
    cells.forEach(({ row, col }) => {
      const flags = this.formats[row][col].replace(flag, "")
      this.#setFormat(row, col, on ? flags + flag : flags)
    })
    this.#updateToolbar()
    this.scheduleSave()
  }

  clearFormat() {
    this.#selectedCells().forEach(({ row, col }) => this.#setFormat(row, col, ""))
    this.#updateToolbar()
    this.scheduleSave()
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
      th.title = "Click to select the column · Shift+click to extend"
      th.addEventListener("pointerdown", (event) => this.#headerDown(event, "col", col))
      th.appendChild(this.#resizeHandle("col", col))
      head.appendChild(th)
    }

    const body = table.createTBody()
    this.cells.forEach((cells, row) => {
      const tr = body.insertRow()
      const th = document.createElement("th")
      th.scope = "row"
      th.textContent = row + 1
      th.title = "Click to select the row · Shift+click to extend"
      th.addEventListener("pointerdown", (event) => this.#headerDown(event, "row", row))
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
        applyFormat(input, this.formats[row][col])
        input.addEventListener("input", () => this.#edit(row, col, input.value))
        input.addEventListener("focus", () => { if (!this.keepSelection) this.#select({ row, col }) })
        input.addEventListener("pointerdown", (event) => this.#pointerDown(event, row, col))
        input.addEventListener("keydown", (event) => this.#navigate(event, row, col))
        tr.insertCell().appendChild(input)
      })
    })

    this.#highlightSelection()
  }

  get #colCount() {
    return this.cells[0].length
  }

  // one entry per column / row, padded with null (default size) and trimmed to the grid
  #loadSizes(colWidths, rowHeights) {
    this.colWidths = Array.from({ length: this.#colCount }, (_, col) => colWidths[col] ?? null)
    this.rowHeights = Array.from({ length: this.cells.length }, (_, row) => rowHeights[row] ?? null)
  }

  // same shape as the grid, "" = plain
  #loadFormats(formats) {
    this.formats = this.cells.map((cells, row) => cells.map((_, col) => formats[row]?.[col] ?? ""))
  }

  #appendRow() {
    if (this.cells.length >= this.maxRowsValue) return false
    this.cells.push(Array(this.#colCount).fill(""))
    this.formats.push(Array(this.#colCount).fill(""))
    this.rowHeights.push(null)
    return true
  }

  #appendColumn() {
    if (this.#colCount >= this.maxColsValue) return false
    this.cells.forEach((row) => row.push(""))
    this.formats.forEach((row) => row.push(""))
    this.colWidths.push(null)
    return true
  }

  #setFormat(row, col, flags) {
    this.formats[row][col] = flags
    const input = this.#input(row, col)
    if (input) applyFormat(input, flags)
  }

  #edit(row, col, value) {
    this.cells[row][col] = value
    this.scheduleSave()
  }

  #changed(cell) {
    this.render()
    this.#focus(cell)
    this.scheduleSave()
  }

  // --- selection ---

  // top/bottom rows and left/right columns of the selected rectangle
  get #range() {
    return {
      top: Math.min(this.anchor.row, this.corner.row),
      bottom: Math.max(this.anchor.row, this.corner.row),
      left: Math.min(this.anchor.col, this.corner.col),
      right: Math.max(this.anchor.col, this.corner.col)
    }
  }

  get #multiple() {
    return this.anchor.row !== this.corner.row || this.anchor.col !== this.corner.col
  }

  #selectedCells() {
    const { top, bottom, left, right } = this.#range
    const cells = []
    for (let row = top; row <= bottom; row++) {
      for (let col = left; col <= right; col++) cells.push({ row, col })
    }
    return cells
  }

  // select from anchor to corner (a single cell when corner is left out)
  #select(anchor, corner = anchor) {
    this.anchor = this.#clamp(anchor)
    this.corner = this.#clamp(corner)
    this.#highlightSelection()
  }

  #extendTo(corner) {
    this.#select(this.anchor, corner)
  }

  // move to a single cell and focus it
  #focus(cell) {
    this.#select(cell)
    this.#focusAnchor()
  }

  // focus the anchor cell without collapsing the selection around it
  #focusAnchor() {
    this.keepSelection = true
    this.#input(this.anchor.row, this.anchor.col)?.focus()
    this.keepSelection = false
  }

  #clamp({ row, col }) {
    return {
      row: Math.min(Math.max(row, 0), this.cells.length - 1),
      col: Math.min(Math.max(col, 0), this.#colCount - 1)
    }
  }

  // Shift+click extends; a plain press starts a new selection that a drag can grow
  #pointerDown(event, row, col) {
    if (event.button !== 0) return
    if (event.shiftKey) {
      event.preventDefault() // keep focus (and typing) in the anchor cell
      this.#extendTo({ row, col })
      return
    }
    this.#select({ row, col })
    this.dragging = true
  }

  #dragOver(event) {
    if (!this.dragging) return
    const input = event.target.closest?.("input[data-row]")
    if (input) this.#extendTo({ row: Number(input.dataset.row), col: Number(input.dataset.col) })
  }

  // column letter / row number: the whole column or row (Shift+click: through to it)
  #headerDown(event, axis, index) {
    if (event.button !== 0 || event.target !== event.currentTarget) return // not the resize handle
    event.preventDefault()

    const last = { row: this.cells.length - 1, col: this.#colCount - 1 }
    if (axis === "col") {
      const from = event.shiftKey ? this.anchor.col : index
      this.#select({ row: 0, col: from }, { row: last.row, col: index })
    } else {
      const from = event.shiftKey ? this.anchor.row : index
      this.#select({ row: from, col: 0 }, { row: index, col: last.col })
    }
    this.#focusAnchor()
  }

  // --- clipboard ---

  // Copies the selection as tab-separated rows. With one cell selected, text highlighted inside it
  // copies normally; otherwise the whole cell is copied. Returns whether it took over the copy.
  #copy(event) {
    const input = event.target.closest?.("input[data-row]")
    if (!input) return false
    if (!this.#multiple && input.selectionStart !== input.selectionEnd) return false

    event.preventDefault()
    const { top, bottom, left, right } = this.#range
    const block = (grid) => grid.slice(top, bottom + 1).map((row) => row.slice(left, right + 1))
    const text = block(this.cells).map((row) => row.join("\t")).join("\n")
    event.clipboardData.setData("text/plain", text)
    // formats can't ride along in plain text, so remember them for a paste of this same text
    this.copied = { text, formats: block(this.formats) }
    return true
  }

  #paste(event) {
    if (!event.target.closest?.("input[data-row]")) return

    const text = event.clipboardData.getData("text/plain")
    const block = text.replace(/\r?\n$/, "").split(/\r?\n/).map((line) => line.split("\t"))
    const single = block.length === 1 && block[0].length === 1
    if (single && !this.#multiple) return // ordinary paste into the cell's text

    event.preventDefault()
    const formats = this.copied?.text === text ? this.copied.formats : null
    const { top, left } = this.#range

    if (single) {
      this.#selectedCells().forEach(({ row, col }) => this.#putCell(row, col, block[0][0], formats?.[0][0]))
    } else {
      const width = Math.max(...block.map((row) => row.length))
      while (this.cells.length < top + block.length && this.#appendRow());
      while (this.#colCount < left + width && this.#appendColumn());
      block.forEach((values, i) => values.forEach((value, j) => {
        if (top + i < this.cells.length && left + j < this.#colCount) {
          this.#putCell(top + i, left + j, value, formats?.[i]?.[j])
        }
      }))
      this.anchor = { row: top, col: left }
      this.corner = this.#clamp({ row: top + block.length - 1, col: left + width - 1 })
    }

    this.render()
    this.#focusAnchor()
    this.scheduleSave()
  }

  // into the data only (the caller re-renders); format is left alone unless one was copied
  #putCell(row, col, value, format) {
    this.cells[row][col] = value.slice(0, this.maxCellLengthValue)
    if (format !== undefined) this.formats[row][col] = format
  }

  #clearSelected() {
    this.#selectedCells().forEach(({ row, col }) => {
      this.cells[row][col] = ""
      const input = this.#input(row, col)
      if (input) input.value = ""
    })
    this.scheduleSave()
  }

  #input(row, col) {
    return this.gridTarget.querySelector(`input[data-row="${row}"][data-col="${col}"]`)
  }

  // arrows move between cells (left/right only at the edge of the text); Enter moves down.
  // Shift+arrows extend the selection; Delete / Backspace clear it when it's more than one cell.
  #navigate(event, row, col) {
    const input = event.target
    const atStart = input.selectionStart === 0 && input.selectionEnd === 0
    const atEnd = input.selectionStart === input.value.length

    if (this.#formatShortcut(event)) return

    if (event.key === "Escape" && this.#multiple) {
      this.#select(this.anchor)
      return
    }

    if ((event.key === "Delete" || event.key === "Backspace") && this.#multiple) {
      event.preventDefault()
      this.#clearSelected()
      return
    }

    if (event.shiftKey && event.key.startsWith("Arrow")) {
      const sideways = this.#multiple || (event.key === "ArrowLeft" ? atStart : atEnd)
      const steps = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: sideways ? [0, -1] : null, ArrowRight: sideways ? [0, 1] : null }
      const step = steps[event.key]
      if (!step) return // Shift+Left/Right inside the text selects text

      event.preventDefault()
      this.#extendTo({ row: this.corner.row + step[0], col: this.corner.col + step[1] })
      return
    }

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
    this.#focus({ row: row + move[0], col: col + move[1] })
  }

  #formatShortcut(event) {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return false

    const key = event.key.toLowerCase()
    const flag = event.shiftKey ? { x: "s" }[key] : { b: "b", i: "i", u: "u" }[key]
    if (!flag) return false

    event.preventDefault()
    this.format({ params: { flag } })
    return true
  }

  // selected cells, their column letters and row numbers, and the toolbar's pressed state
  #highlightSelection() {
    const { top, bottom, left, right } = this.#range
    this.gridTarget.querySelectorAll("[data-active], [data-selected]").forEach((el) => {
      delete el.dataset.active
      delete el.dataset.selected
    })

    const headers = this.gridTarget.tHead?.rows[0].cells
    const rows = this.gridTarget.tBodies[0]?.rows
    for (let col = left; col <= right; col++) headers?.[col + 1]?.setAttribute("data-active", "")
    for (let row = top; row <= bottom; row++) {
      rows?.[row]?.cells[0]?.setAttribute("data-active", "")
      for (let col = left; col <= right; col++) rows?.[row]?.cells[col + 1]?.setAttribute("data-selected", "")
    }
    this.gridTarget.toggleAttribute("data-multiple", this.#multiple)
    this.#updateToolbar()
  }

  // a format button is pressed when every selected cell has that format
  #updateToolbar() {
    const cells = this.#selectedCells()
    this.formatButtonTargets.forEach((button) => {
      const flag = button.dataset.spreadSheetFlagParam
      if (!flag) return
      const on = cells.every(({ row, col }) => this.formats[row]?.[col]?.includes(flag))
      button.setAttribute("aria-pressed", on)
    })
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

  // as wide as the column's longest text, measured in each cell's own font (bold is wider)
  #fitColumn(col) {
    if (!this.#input(0, col)) return

    this.measure ||= document.createElement("canvas").getContext("2d")
    const widest = Math.max(0, ...this.cells.map((cells, row) => {
      this.measure.font = getComputedStyle(this.#input(row, col)).font
      return this.measure.measureText(cells[col]).width
    }))
    const [min, max] = this.widthRangeValue
    this.#setColWidth(col, clamp(Math.ceil(widest + CELL_PADDING_X), [Math.max(min, FIT_MIN_WIDTH), max]))
  }
}

// 0 → A, 25 → Z
function columnName(index) {
  return String.fromCharCode(65 + index)
}

// a cell's format flags (b i u s); .sheet-grid input[data-format] styles them
function applyFormat(input, flags) {
  if (flags) {
    input.dataset.format = flags
  } else {
    delete input.dataset.format
  }
}

function sizedCol(width) {
  const col = document.createElement("col")
  col.style.width = `${width}px`
  return col
}

function clamp(value, [min, max]) {
  return Math.min(Math.max(Math.round(value), min), max)
}
