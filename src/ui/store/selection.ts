import { readable, derived } from 'svelte/store'
import { messenger } from '@src/message-handler'

type SelectionData = {
  count: number
  references: string[]
  frameKind: 'annotation' | 'info' | null
}

const selection = readable<SelectionData>(
  { count: 0, references: [], frameKind: null },
  (set) => {
    const unsubscribe = messenger.on('selection-changed', (data) => {
      set(data)
    })

    // Ask the plugin to re-emit the current selection. selectionchange doesn't
    // fire at plugin startup, so without this the store would stay on its
    // empty default until the user touches the canvas.
    messenger
      .request('refresh-selection')
      .catch((err) => console.error('[selection] refresh failed:', err))

    return unsubscribe
  },
)

export default selection

export const selectionCount = derived(selection, ($s) => $s.count)
export const selectionFrameKind = derived(selection, ($s) => $s.frameKind)
