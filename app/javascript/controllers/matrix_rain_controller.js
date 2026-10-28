import { Controller } from "@hotwired/stimulus"

const GLYPHS = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789"
const CELL = 18
const FRAME_MS = 60

// Faint "digital rain" drawn on a background <canvas>.
// Off under prefers-reduced-motion; paused while the tab is hidden.
export default class extends Controller {
  connect() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    this.ctx = this.element.getContext("2d")
    this.resize = this.resize.bind(this)
    this.onVisibility = this.onVisibility.bind(this)
    window.addEventListener("resize", this.resize)
    document.addEventListener("visibilitychange", this.onVisibility)
    this.resize()
    this.start()
  }

  disconnect() {
    this.stop()
    window.removeEventListener("resize", this.resize)
    document.removeEventListener("visibilitychange", this.onVisibility)
  }

  resize() {
    this.element.width = window.innerWidth
    this.element.height = window.innerHeight
    const columns = Math.ceil(this.element.width / CELL)
    const rows = Math.ceil(this.element.height / CELL)
    // stagger the start so the screen is already raining on load
    this.drops = Array.from({ length: columns }, () => Math.floor(Math.random() * rows))
  }

  onVisibility() {
    document.hidden ? this.stop() : this.start()
  }

  start() {
    if (this.timer) return
    this.timer = setInterval(() => this.draw(), FRAME_MS)
  }

  stop() {
    clearInterval(this.timer)
    this.timer = null
  }

  draw() {
    const { ctx } = this
    const { width, height } = this.element

    // fade the previous frame instead of clearing, which leaves the trails
    ctx.fillStyle = "rgba(2, 10, 4, 0.12)"
    ctx.fillRect(0, 0, width, height)
    ctx.font = `${CELL - 2}px "VT323", monospace`

    this.drops.forEach((row, column) => {
      const glyph = GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
      ctx.fillStyle = Math.random() > 0.97 ? "#c4ffd4" : "#3dff72"
      ctx.fillText(glyph, column * CELL, row * CELL)

      this.drops[column] = row * CELL > height && Math.random() > 0.975 ? 0 : row + 1
    })
  }
}
