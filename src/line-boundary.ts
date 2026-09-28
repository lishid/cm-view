import {SelectionRange} from "@codemirror/state"
import {EditorView} from "./editorview"
import {moveToLineBoundary} from "./cursor"

function onSameVisualLine(view: EditorView, a: SelectionRange, b: SelectionRange) {
  let aCoords = view.coordsAtPos(a.head, a.assoc || 1), bCoords = view.coordsAtPos(b.head, b.assoc || 1)
  if (!aCoords || !bCoords) return false
  let y = (aCoords.top + aCoords.bottom) / 2
  return y > bCoords.top && y < bCoords.bottom
}

// Wraps `moveToLineBoundary` for wrapped bidirectional lines, where
// the position at the visual edge of the last visual line is not
// the side of the line (codemirror/dev#1747).
export function moveToBidiLineBoundary(view: EditorView, start: SelectionRange, forward: boolean, includeWrap: boolean) {
  let side = moveToLineBoundary(view, start, forward, false)
  if (!includeWrap || start.head == side.head) return side
  // An assoc pointing out of the line can measure on another visual line
  let opposite = moveToLineBoundary(view, start, !forward, false)
  let from = start.head == opposite.head ? opposite : start
  if (onSameVisualLine(view, from, side)) return side
  return moveToLineBoundary(view, from, forward, true)
}
