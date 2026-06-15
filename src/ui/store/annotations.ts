import { readable, type Readable } from 'svelte/store'
import { messenger } from '@src/message-handler'
import type { AnnotationRecord } from '@src/types'
import { derived } from 'svelte/store'

// Create a readable store that syncs with annotation changes from the plugin
export const annotations: Readable<AnnotationRecord[]> = readable<
  AnnotationRecord[]
>(
  // Initial value - empty array until we get actual annotations
  [],
  (set) => {
    // Listen for annotation changes from the plugin
    const unsubscribe = messenger.on(
      'annotations-changed',
      (newAnnotations) => {
        set(newAnnotations)
      },
    )

    // Request current annotations state immediately
    messenger
      .request('get-annotations')
      .then((currentAnnotations) => {
        set(currentAnnotations)
      })
      .catch((error) => {
        console.error('[UI] Failed to get initial annotations:', error)
      })

    // Return cleanup function
    return unsubscribe
  },
)

// Navigation annotations (tab, arrow)
export const navigationAnnotations = derived(annotations, ($annotations) =>
  $annotations.filter(
    (annotation) => annotation.kind === 'tab' || annotation.kind === 'arrow',
  ),
)

// Note annotations (note, component-note, presentational)
export const noteAnnotations = derived(annotations, ($annotations) =>
  $annotations.filter(
    (annotation) =>
      annotation.kind === 'note' ||
      annotation.kind === 'component-note' ||
      annotation.kind === 'presentational',
  ),
)
