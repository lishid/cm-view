import {tempView, requireFocus} from "./tempview.js"
import {EditorState, StateField, StateEffect} from "@codemirror/state"
import {Decoration, DecorationSet, EditorView, WidgetType} from "@codemirror/view"
import ist from "ist"

function flush(cm: EditorView) {
  cm.observer.flush()
}

describe("DOM changes", () => {
  it("notices text changes", () => {
    let cm = tempView("foo\nbar")
    cm.domAtPos(1).node.nodeValue = "froo"
    flush(cm)
    ist(cm.state.doc.toString(), "froo\nbar")
  })

  it("handles browser enter behavior", () => {
    let cm = tempView("foo\nbar"), line0 = cm.contentDOM.firstChild!
    line0.appendChild(document.createElement("br"))
    line0.appendChild(document.createElement("br"))
    flush(cm)
    ist(cm.state.doc.toString(), "foo\n\nbar")
  })

  it("supports deleting lines", () => {
    let cm = tempView("1\n2\n3\n4\n5\n6")
    for (let i = 0, lineDOM = cm.contentDOM; i < 4; i++) lineDOM.childNodes[1].remove()
    flush(cm)
    ist(cm.state.doc.toString(), "1\n6")
  })

  it("can deal with large insertions", () => {
    let cm = tempView("okay")
    let node = document.createElement("div")
    node.textContent = "ayayayayayay"
    for (let i = 0, lineDOM = cm.domAtPos(0).node.parentNode!; i < 100; i++) lineDOM.appendChild(node.cloneNode(true))
    flush(cm)
    ist(cm.state.doc.toString(), "okay" + "\nayayayayayay".repeat(100))
  })

  it("properly handles selection for ambiguous backspace", () => {
    let cm = tempView("foo")
    cm.dispatch({selection: {anchor: 2}})
    cm.domAtPos(1).node.nodeValue = "fo"
    cm.inputState.lastKeyCode = 8
    cm.inputState.lastKeyTime = Date.now()
    flush(cm)
    ist(cm.state.selection.main.anchor, 1)
  })

  it("notices text changes at the end of a long document", () => {
    let cm = tempView("foo\nbar\n".repeat(15))
    cm.domAtPos(8*15).node.textContent = "a"
    flush(cm)
    ist(cm.state.doc.toString(), "foo\nbar\n".repeat(15) + "a")
  })

  it("handles replacing a selection with a prefix of itself", () => {
    let cm = tempView("foo\nbar")
    cm.dispatch({selection: {anchor: 0, head: 7}})
    cm.contentDOM.textContent = "f"
    flush(cm)
    ist(cm.state.doc.toString(), "f")
  })

  it("doesn't add a line break when typing over the last two lines", () => {
    let cm = tempView("foo\nbar")
    cm.dispatch({selection: {anchor: 1, head: 5}})
    let [line0, line1] = Array.from(cm.contentDOM.childNodes)
    line0.textContent = "fXar"
    line1.remove()
    flush(cm)
    ist(cm.state.doc.toString(), "fXar")
  })

  it("handles replacing a selection with a suffix of itself", () => {
    let cm = tempView("foo\nbar")
    cm.dispatch({selection: {anchor: 0, head: 7}})
    cm.contentDOM.textContent = "r"
    flush(cm)
    ist(cm.state.doc.toString(), "r")
  })

  it("handles replacing a selection with a prefix of itself and something else", () => {
    let cm = tempView("foo\nbar")
    cm.dispatch({selection: {anchor: 0, head: 7}})
    cm.contentDOM.textContent = "fa"
    flush(cm)
    ist(cm.state.doc.toString(), "fa")
  })

  it("handles replacing a selection with a suffix of itself and something else", () => {
    let cm = tempView("foo\nbar")
    cm.dispatch({selection: {anchor: 0, head: 7}})
    cm.contentDOM.textContent = "br"
    flush(cm)
    ist(cm.state.doc.toString(), "br")
  })

  it("handles replacing a selection with new content that shares a prefix and a suffix", () => {
    let cm = tempView("foo\nbar")
    cm.dispatch({selection: {anchor: 1, head: 6}})
    cm.contentDOM.textContent = "fo--ar"
    flush(cm)
    ist(cm.state.doc.toString(), "fo--ar")
  })

  it("handles appending", () => {
    let cm = tempView("foo\nbar")
    cm.dispatch({selection: {anchor: 7}})
    cm.contentDOM.appendChild(document.createElement("div"))
    flush(cm)
    ist(cm.state.doc.toString(), "foo\nbar\n")
  })

  it("handles deleting the first line and the newline after it", () => {
    let cm = tempView("foo\nbar\n\nbaz")
    cm.contentDOM.innerHTML = "bar<div><br></div><div>baz</div>"
    flush(cm)
    ist(cm.state.doc.toString(), "bar\n\nbaz")
  })

  it("handles deleting a line with an empty line after it", () => {
    let cm = tempView("foo\nbar\n\nbaz")
    cm.contentDOM.innerHTML = "<div>foo</div><br><div>baz</div>"
    flush(cm)
    ist(cm.state.doc.toString(), "foo\n\nbaz")
  })

  it("doesn't drop collapsed text", () => {
    let field = StateField.define<DecorationSet>({
      create() { return Decoration.set(Decoration.replace({}).range(1, 3)) },
      update() { return Decoration.none },
      provide: f => EditorView.decorations.from(f)
    })
    let cm = tempView("abcd", [field])
    cm.domAtPos(0).node.textContent = "x"
    flush(cm)
    ist(cm.state.doc.toString(), "xbcd")
  })

  it("preserves text nodes when edited in the middle", () => {
    let cm = tempView("abcd"), text = cm.domAtPos(1).node
    text.textContent = "axxd"
    flush(cm)
    ist(cm.domAtPos(1).node, text)
  })

  it("preserves text nodes when edited at the start", () => {
    let cm = tempView("abcd"), text = cm.domAtPos(1).node
    text.textContent = "xxcd"
    flush(cm)
    ist(cm.domAtPos(1).node, text)
  })

  it("preserves text nodes when edited at the end", () => {
    let cm = tempView("abcd"), text = cm.domAtPos(1).node
    text.textContent = "abxx"
    flush(cm)
    ist(cm.domAtPos(1).node, text)
  })

  it("doesn't insert newlines for block widgets", () => {
    class Widget extends WidgetType {
      toDOM() { return document.createElement("div") }
    }
    let field = StateField.define<DecorationSet>({
      create() { return Decoration.set(Decoration.widget({widget: new Widget }).range(4)) },
      update(v) { return v },
      provide: f => EditorView.decorations.from(f)
    })
    let cm = tempView("abcd", [field])
    cm.contentDOM.firstChild!.appendChild(document.createTextNode("x"))
    flush(cm)
    ist(cm.state.doc.toString(), "abcdx")
  })

  it("correctly handles changes ending on a widget", () => {
    let widget = new class extends WidgetType {
      toDOM() { return document.createElement("strong") }
    }
    let field = StateField.define<DecorationSet>({
      create() { return Decoration.set([Decoration.widget({widget}).range(2),
                                        Decoration.widget({widget}).range(7)]) },
      update(v, tr) { return v.map(tr.changes) },
      provide: f => EditorView.decorations.from(f)
    })
    let cm = tempView("one two thr", [field])
    let wDOM = cm.contentDOM.querySelectorAll("strong")[1]
    cm.domAtPos(6).node.nodeValue = "e"
    wDOM.remove()
    flush(cm)
    ist(cm.state.doc.toString(), "one thr")
  })

  it("calls input handlers", () => {
    let cm = tempView("abc", [EditorView.inputHandler.of((_v, from, to, insert) => {
      cm.dispatch({changes: {from, to, insert: insert.toUpperCase()}})
      return true
    })])
    cm.contentDOM.firstChild!.appendChild(document.createTextNode("d"))
    flush(cm)
    ist(cm.state.doc.toString(), "abcD")
  })

  it("ignores dom-changes in read-only mode", () => {
    let cm = tempView("abc", [EditorState.readOnly.of(true)])
    cm.domAtPos(0).node.nodeValue = "abx"
    flush(cm)
    ist(cm.state.doc.toString(), "abc")
    ist(cm.contentDOM.textContent, "abc")
  })

  it("can handle crlf insertion", () => {
    let cm = tempView("abc")
    let text = cm.domAtPos(1).node
    text.nodeValue = "ab\r\nc"
    getSelection()!.collapse(text, 4)
    flush(cm)
    ist(cm.state.doc.toString(), "ab\nc")
    ist(cm.state.selection.main.head, 3)
  })

  it("works when line breaks are multiple characters", () => {
    let cm = tempView("abc", [EditorState.lineSeparator.of("\r\n")])
    let text = cm.domAtPos(1).node
    text.nodeValue = "ab\r\nc"
    getSelection()!.collapse(text, 4)
    flush(cm)
    ist(cm.state.sliceDoc(), "ab\r\nc")
    ist(cm.state.selection.main.head, 3)
  })

  it("doesn't insert a newline after a block widget", () => {
    let widget = new class extends WidgetType {
      toDOM() { return document.createElement("div") }
    }
    let cm = tempView("\n\n", [EditorView.decorations.of(Decoration.set(Decoration.widget({widget, block: true}).range(0)))])
    let newLine = document.createElement("div")
    newLine.innerHTML = "<br>"
    cm.contentDOM.insertBefore(newLine, cm.contentDOM.childNodes[1])
    flush(cm)
    ist(cm.state.sliceDoc(), "\n\n\n")
  })

  it("can repair attributes on lines", () => {
    let cm = tempView("ab\ncd", [EditorView.decorations.of(Decoration.set(Decoration.line({class: "x"}).range(0)))])
    cm.contentDOM.children[0].classList.remove("x")
    cm.contentDOM.children[1].setAttribute("foo", "foo")
    flush(cm)
    cm.measure()
    ist(cm.contentDOM.children[0].className, "cm-line x")
    ist(cm.contentDOM.children[1].getAttribute("foo"), null)
  })

  it("can repair attributes on marks", () => {
    let cm = tempView("abcd", [EditorView.decorations.of(Decoration.set(Decoration.mark({class: "x"}).range(1, 3)))])
    cm.contentDOM.children[0].children[0].className = "huh"
    flush(cm)
    cm.measure()
    ist(cm.contentDOM.children[0].children[0].className, "x")
  })

  it("doesn't write a held selection when redrawing the node its head is in", () => {
    let toggle = StateEffect.define<null>()
    let field = StateField.define<DecorationSet>({
      create: () => Decoration.set(Decoration.replace({}).range(0, 4)),
      update(deco, tr) {
        return tr.effects.some(e => e.is(toggle)) ? Decoration.set(Decoration.replace({widget: new class extends WidgetType {
          toDOM() { return document.createElement("b") }
        }}).range(0, 4)) : deco
      },
      provide: f => EditorView.decorations.from(f)
    })
    let cm = requireFocus(tempView("one two three", [field]))
    cm.dispatch({selection: {anchor: 8, head: 4}})
    let line = cm.contentDOM.firstChild!, text = cm.domAtPos(8).node
    // The browser's anchor differs from the held one, as when a handle drag starts far from the other end
    cm.observer.ignore(() => getSelection()!.setBaseAndExtent(text, 6, line, Array.from(line.childNodes).indexOf(text as ChildNode)))
    cm.observer.readSelectionRange()
    cm.inputState.androidSelection = 8
    let sel = getSelection()!, writes = 0
    sel.collapse = function(...args: [Node | null, number?]) { writes++; return Selection.prototype.collapse.apply(this, args) }
    try {
      cm.dispatch({effects: toggle.of(null)})
    } finally {
      delete (sel as any).collapse
      cm.inputState.endAndroidSelection()
    }
    ist(writes, 0)
    ist(cm.docView.posFromDOM(sel.focusNode!, sel.focusOffset), 4)
  })

  it("writes a held selection back when a redraw moves it", () => {
    let toggle = StateEffect.define<null>()
    let field = StateField.define<DecorationSet>({
      create: () => Decoration.none,
      update(deco, tr) {
        return tr.effects.some(e => e.is(toggle)) ? Decoration.set(Decoration.mark({class: "x"}).range(4, 7)) : deco
      },
      provide: f => EditorView.decorations.from(f)
    })
    let cm = requireFocus(tempView("one two three four", [field]))
    cm.dispatch({selection: {anchor: 0, head: 11}})
    cm.inputState.androidSelection = 0
    try {
      cm.dispatch({effects: toggle.of(null)})
      let sel = getSelection()!
      ist(cm.docView.posFromDOM(sel.anchorNode!, sel.anchorOffset), 0)
      ist(cm.docView.posFromDOM(sel.focusNode!, sel.focusOffset), 11)
    } finally {
      cm.inputState.endAndroidSelection()
    }
  })

  it("keeps a selection the browser moved when the hold ends", () => {
    let cm = requireFocus(tempView("one two three"))
    cm.dispatch({selection: {anchor: 4, head: 7}})
    cm.inputState.androidSelection = 4
    cm.inputState.androidSelectionNeedsFlush = true
    let text = cm.domAtPos(4).node
    getSelection()!.setBaseAndExtent(text, 4, text, 13)
    cm.inputState.endAndroidSelection()
    ist(getSelection()!.focusOffset, 13)
  })

  it("ends the hold when the document changes", () => {
    let cm = requireFocus(tempView("one two three"))
    cm.dispatch({selection: {anchor: 4, head: 7}})
    cm.inputState.androidSelection = 4
    cm.dispatch({changes: {from: 4, insert: "**"}, selection: {anchor: 6, head: 9}})
    ist(cm.selectionLeftToBrowser, false)
    let sel = getSelection()!
    ist(cm.docView.posFromDOM(sel.anchorNode!, sel.anchorOffset), 6)
    ist(cm.docView.posFromDOM(sel.focusNode!, sel.focusOffset), 9)
  })

  it("holds each drag of a touch selection until its handle is released", () => {
    let cm = requireFocus(tempView("one two three")), iState = cm.inputState
    cm.dispatch({selection: {anchor: 4, head: 7}})
    iState.androidTouchSelected = true
    iState.lastContextMenu = Date.now() - 200
    iState.selectionchange()
    ist(cm.selectionLeftToBrowser, true)
    iState.endAndroidSelection()
    iState.lastContextMenu = Date.now()
    iState.selectionchange()
    ist(cm.selectionLeftToBrowser, false)
    iState.lastContextMenu = Date.now() - 200
    iState.selectionchange()
    ist(cm.selectionLeftToBrowser, true)
    iState.endAndroidTouchSelection()
    ist(cm.selectionLeftToBrowser, false)
    iState.selectionchange()
    ist(cm.selectionLeftToBrowser, false)
  })

  it("doesn't hold a touch selection on its own selection writes", () => {
    let cm = requireFocus(tempView("one two three")), iState = cm.inputState
    iState.androidTouchSelected = true
    iState.lastContextMenu = Date.now() - 200
    try {
      cm.dispatch({selection: {anchor: 4, head: 7}})
      cm.observer.onSelectionChange(new Event("selectionchange"))
      ist(cm.selectionLeftToBrowser, false)
      let text = cm.domAtPos(4).node
      getSelection()!.setBaseAndExtent(text, 4, text, 13)
      cm.observer.onSelectionChange(new Event("selectionchange"))
      ist(cm.selectionLeftToBrowser, true)
    } finally {
      iState.endAndroidTouchSelection()
    }
  })

  it("keeps the end of a held selection that the dragged handle leaves", () => {
    let cm = requireFocus(tempView("one two three four")), iState = cm.inputState
    cm.dispatch({selection: {anchor: 4, head: 13}})
    iState.androidTouchSelected = true
    iState.lastContextMenu = Date.now() - 200
    try {
      let text = cm.domAtPos(4).node
      getSelection()!.setBaseAndExtent(text, 10, text, 2)
      cm.observer.onSelectionChange(new Event("selectionchange"))
      ist(cm.state.selection.main.anchor, 13)
      ist(cm.state.selection.main.head, 2)
      getSelection()!.setBaseAndExtent(text, 10, text, 16)
      cm.observer.onSelectionChange(new Event("selectionchange"))
      ist(cm.state.selection.main.anchor, 13)
      ist(cm.state.selection.main.head, 16)
    } finally {
      iState.endAndroidTouchSelection()
    }
  })

  it("doesn't hold a caret's handle drag", () => {
    let cm = requireFocus(tempView("one two three")), iState = cm.inputState
    cm.dispatch({selection: {anchor: 4}})
    iState.androidTouchSelected = true
    iState.lastContextMenu = Date.now() - 200
    try {
      getSelection()!.collapse(cm.domAtPos(4).node, 8)
      cm.observer.onSelectionChange(new Event("selectionchange"))
      ist(cm.selectionLeftToBrowser, false)
      ist(cm.state.selection.main.anchor, 8)
      ist(cm.state.selection.main.head, 8)
    } finally {
      iState.endAndroidTouchSelection()
    }
  })

  it("keeps a held selection from the document start when the head reads past the viewport", () => {
    let cm = requireFocus(tempView("ab cd\n" + "line\n".repeat(2000), [
      EditorView.contentAttributes.of({style: "overflow: auto"}),
      EditorView.editorAttributes.of({style: "height: 300px"})
    ])), iState = cm.inputState
    cm.dispatch({selection: {anchor: 0, head: 2}})
    cm.scrollDOM.scrollTop = 3000
    cm.measure()
    iState.androidTouchSelected = true
    iState.lastContextMenu = Date.now() - 200
    try {
      let gaps = cm.contentDOM.querySelectorAll(".cm-gap"), gap = gaps[gaps.length - 1]
      let head = cm.docView.posFromDOM(gap, 0)
      getSelection()!.setBaseAndExtent(cm.domAtPos(0).node, 0, gap, 0)
      cm.observer.onSelectionChange(new Event("selectionchange"))
      ist(cm.state.selection.main.anchor, 0)
      ist(cm.state.selection.main.head, head)
    } finally {
      iState.endAndroidTouchSelection()
    }
  })

  it("keeps a touch selection through a touch that doesn't tap", () => {
    let cm = tempView("one two three"), iState = cm.inputState
    iState.androidTouchSelected = true
    iState.androidSelection = 4
    cm.contentDOM.dispatchEvent(new TouchEvent("touchstart", {bubbles: true}))
    ist(cm.selectionLeftToBrowser, false)
    ist(iState.androidTouchSelected, true)
    cm.contentDOM.dispatchEvent(new MouseEvent("mousedown", {bubbles: true}))
    ist(iState.androidTouchSelected, false)
  })

  it("restores a held selection when focus returns", async () => {
    let cm = requireFocus(tempView("one two three"))
    cm.dispatch({selection: {anchor: 4, head: 7}})
    cm.inputState.androidSelection = 4
    let input = document.body.appendChild(document.createElement("input"))
    try {
      input.focus()
      await new Promise(resolve => setTimeout(resolve, 50))
      cm.focus()
      await new Promise(resolve => setTimeout(resolve, 50))
      let sel = getSelection()!
      ist(sel.anchorOffset, 4)
      ist(sel.focusOffset, 7)
      ist(cm.state.selection.main.from, 4)
      ist(cm.state.selection.main.to, 7)
    } finally {
      input.remove()
      cm.inputState.endAndroidSelection()
    }
  })
})
