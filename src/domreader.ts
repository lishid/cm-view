import {Tile} from "./tile"
import {domIndex, maxOffset, isBlockElement, isElt, isText} from "./dom"
import {EditorView} from "./editorview"
import {EditorState} from "@codemirror/state"

export const LineBreakPlaceholder = "\uffff"

export class DOMReader {
  text: string = ""
  lineSeparator: string | undefined
  afterBreak = true

  constructor(private points: DOMPoint[], view: EditorView) {
    this.lineSeparator = view.state.facet(EditorState.lineSeparator)
  }

  append(text: string) {
    this.text += text
    if (text.length) this.afterBreak = false
  }

  lineBreak() {
    this.text += LineBreakPlaceholder
    this.afterBreak = true
  }

  readRange(start: Node, after: boolean, end: Node | null) { // FIXME allow start-of-doc case
    for (let cur: Node = start; cur;) {
      if (after) {
        let next = cur.nextSibling
        if (!next) {
          cur = cur.parentNode!
          let tile = Tile.get(cur)
          if (tile && !tile.parent) break
          this.findPointAtEnd(cur)
          if (tile ? tile.breakAfter : isBlockElement(cur) && !isEmptyToEnd(cur, end)) {
            this.lineBreak()
          }
        } else if (next == end) {
          break
        } else {
          cur = next
          after = false
        }
      } else {
        this.findPointBefore(cur)
        let tile = Tile.get(cur), fromTile = tile && tile.overrideDOMText
        if (fromTile != null) {
          this.findPointInside(cur, fromTile.length)
          for (let i = fromTile.iter(); !i.next().done;) {
            if (i.lineBreak) this.lineBreak()
            else this.append(i.value)
          }
        } else if (isText(cur)) {
          this.readTextNode(cur)
        } else if (cur.nodeName == "BR") {
          if (cur.nextSibling) this.lineBreak()
        } else if (isElt(cur)) {
          if ((tile ? tile.isBlock() : isBlockElement(cur)) && !this.afterBreak)
            this.lineBreak()
          let child = cur.firstChild
          if (child) {
            if (child == end) break
            cur = child
            continue
          } else if (tile ? tile.breakAfter : isBlockElement(cur) && !isEmptyToEnd(cur, end)) {
            this.lineBreak()
          }
        }
        after = true
      }
    }
    return this
  }

  readTextNode(node: Text) {
    let text = node.nodeValue!
    for (let point of this.points)
      if (point.node == node)
        point.pos = this.text.length + Math.min(point.offset, text.length)

    for (let off = 0, re = this.lineSeparator ? null : /\r\n?|\n/g;;) {
      let nextBreak = -1, breakSize = 1, m
      if (this.lineSeparator) {
        nextBreak = text.indexOf(this.lineSeparator, off)
        breakSize = this.lineSeparator.length
      } else if (m = re!.exec(text)) {
        nextBreak = m.index
        breakSize = m[0].length
      }
      this.append(text.slice(off, nextBreak < 0 ? text.length : nextBreak))
      if (nextBreak < 0) break
      this.lineBreak()
      if (breakSize > 1) for (let point of this.points)
        if (point.node == node && point.pos > this.text.length) point.pos -= breakSize - 1
      off = nextBreak + breakSize
    }
  }

  findPointBefore(node: Node) { // FIXME handle end of parent positions
    let parent = node.parentNode!
    for (let point of this.points)
      if (point.node == parent && parent.childNodes[point.offset] == node)
        point.pos = this.text.length
  }

  findPointAtEnd(node: Node) {
    for (let point of this.points)
      if (point.node == node && point.offset == node.childNodes.length)
        point.pos = this.text.length
  }

  findPointInside(node: Node, length: number) {
    for (let point of this.points)
      if (isText(node) ? point.node == node : node.contains(point.node))
        point.pos = this.text.length + (isAtEnd(node, point.node, point.offset) ? length : 0)
  }
}

function isAtEnd(parent: Node, node: Node | null, offset: number) {
  for (;;) {
    if (!node || offset < maxOffset(node)) return false
    if (node == parent) return true
    offset = domIndex(node) + 1
    node = node.parentNode
  }
}

function isEmptyToEnd(node: Node, end: Node | null) {
  let widgets: Tile[] | undefined
  for (let cur = node.nextSibling; cur && node != end; cur = cur.nextSibling) {
    let tile = Tile.get(node)
    if (!tile?.isWidget()) return false
    if (tile) (widgets || (widgets = [])).push(tile)
  }
  if (widgets) for (let w of widgets) {
    let override = w.overrideDOMText
    if (override?.length) return false
  }
  return true
}

export class DOMPoint {
  pos: number = -1
  constructor(readonly node: Node, readonly offset: number) {}
}
