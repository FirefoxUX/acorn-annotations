import { messenger } from '@src/message-handler'
import type { AnnotationKind, PublicState, AnnotationRecord } from '@src/types'
import {
  DEFAULT_STATE,
  DEFAULT_MAIN_WIDTH,
  DEFAULT_HEIGHT,
} from '@src/defaults'
import { createObservableState } from './utils'
import { AnnotationStateManager } from './annotation-state-manager'
import { AnnotationWrap, AnnotationInfoWrap } from './annotation-components'
import {
  registerFrameHandlers,
  registerModeHandlers,
  registerAnnotationHandlers,
  registerUIHandlers,
  registerSavedGroupsHandlers,
  restoreWindowSize,
} from './handlers'
import { loadAndValidateGroups } from './storage/frame-group-storage'
import sceneUtils from './scene-utils'

// Re-export handler functions for message type inference
export {
  setFrame,
  createInfoFrame,
  startAnnotation,
  returnToFrameSelection,
} from './handlers/frame-handlers'
export {
  setMode,
  setAnnotationType,
  setAnnotationMode,
  setSelectionGrouping,
  setSplitInfoFrame,
} from './handlers/mode-handlers'
export {
  createAnnotationFromSelection,
  addToAnnotationFromSelection,
  deleteAnnotation,
  deleteMultipleAnnotations,
  updateMultipleAnnotations,
  mergeAnnotation,
  regroupAnnotations,
  reorderAnnotationByIndex,
  reorderMultipleAnnotationsByIndex,
  selectAnnotationMarkers,
} from './handlers/annotation-handlers'
export {
  selectSceneNode,
  toggleSidebar,
  toggleLockAnnotations,
  setLockState,
  openExternalLink,
  getDebugInfo,
  handleWindowResize,
  restoreWindowSize,
} from './handlers/ui-handlers'
export {
  getSavedGroups,
  loadSavedGroup,
  deleteSavedGroup,
  renameSavedGroup,
  skipToFrameSelection,
} from './handlers/saved-groups-handlers'

// Global instance of the annotation state manager
let annotationStateManager: AnnotationStateManager | null = null

figma.showUI(__html__, {
  width: DEFAULT_MAIN_WIDTH,
  height: DEFAULT_HEIGHT,
})

// Keep track of the last annotation type to support special behavior
// when transitioning between annotation types
let lastAnnotationType: AnnotationKind | null = null

const publicState = createObservableState<PublicState>(
  DEFAULT_STATE,
  (changed) => {
    // notify the UI about the state change
    messenger.notify('state-change', changed)
  },
)

// Restore saved window dimensions as early as possible
restoreWindowSize(publicState)

/**
 * Resolves Figma selection to annotation references and updates state/UI.
 * Handles annotation markers (AnnotationWrap) and info nodes
 * (AnnotationInfoWrap).
 */
function detectFrameKind(
  selection: readonly SceneNode[],
): 'annotation' | 'info' | null {
  if (selection.length !== 1) return null
  const node = selection[0]
  if (node.type !== 'FRAME') return null
  return (node as FrameNode).layoutMode === 'NONE' ? 'annotation' : 'info'
}

async function updateSelectedReference(setNull = false): Promise<void> {
  const selection = figma.currentPage.selection
  const frameKind = detectFrameKind(selection)

  if (!annotationStateManager || setNull) {
    messenger.notify('selection-changed', {
      count: selection.length,
      references: [],
      frameKind,
    })
    return
  }

  const annotations = annotationStateManager.annotations

  // Build a node ID to annotation record map for O(1) lookups.
  const nodeIdToAnnotation = new Map<string, AnnotationRecord>()
  for (const annotation of annotations) {
    for (const nodeId of annotation.annotationNodeId) {
      nodeIdToAnnotation.set(nodeId, annotation)
    }
  }

  const resolvedRefs = new Set<string>()

  for (const node of selection) {
    // Check if it's an annotation marker
    if (AnnotationWrap.isOfType(node)) {
      const annotation = nodeIdToAnnotation.get(node.id)
      if (annotation) {
        resolvedRefs.add(annotation.strReference)
      }
    } else if (AnnotationInfoWrap.isOfType(node as PageNode | SceneNode)) {
      // Check if it's an info node (type assertion needed: both guards narrow to InstanceNode)
      const group = annotationStateManager.infoGroupManager.findByInfoNodeId(
        (node as SceneNode).id,
      )
      if (group) {
        for (const ref of group.references) {
          resolvedRefs.add(ref)
        }
      }
    }
  }

  messenger.notify('selection-changed', {
    count: selection.length,
    references: [...resolvedRefs],
    frameKind,
  })
}

figma.on('selectionchange', () => {
  updateSelectedReference()
})

// UI subscribers re-emit the current selection on demand (e.g. on view mount).
// selectionchange doesn't fire at plugin start, so newly-mounted views would
// otherwise see the initial empty store value.
messenger.on('refresh-selection', () => {
  updateSelectedReference()
  return { success: true } as const
})

// Listen for page changes to reload saved groups when on the saved-groups screen
figma.on('currentpagechange', async () => {
  // Only reload saved groups when viewing the saved-groups screen
  // This allows users to browse pages without disrupting the plugin in annotation mode
  if (publicState.view === 'saved-groups') {
    const savedGroups = await loadAndValidateGroups()
    publicState.savedGroups = savedGroups
  }
})

/** Handle errors in a consistent way across the codebase */
function handleError(error: unknown, operation: string): { error: string } {
  console.error(
    `Failed to ${operation}:`,
    error,
    typeof error === 'object' && error !== null && 'stack' in error
      ? (error as { stack?: string }).stack
      : '',
  )
  return {
    error: error instanceof Error ? error.message : `Failed to ${operation}`,
  }
}

// Helper functions for accessing module-level state
function getManager(): AnnotationStateManager | null {
  return annotationStateManager
}

function setManager(manager: AnnotationStateManager | null) {
  annotationStateManager = manager
}

function getLastAnnotationType(): AnnotationKind | null {
  return lastAnnotationType
}

function setLastAnnotationType(type: AnnotationKind | null) {
  lastAnnotationType = type
}

// Register all handlers
registerFrameHandlers(
  messenger,
  publicState,
  getManager,
  setManager,
  handleError,
)

registerModeHandlers(messenger, publicState)

registerAnnotationHandlers(
  messenger,
  publicState,
  getManager,
  handleError,
  updateSelectedReference,
  getLastAnnotationType,
  setLastAnnotationType,
)

registerUIHandlers(messenger, publicState, getManager, handleError)

registerSavedGroupsHandlers(messenger, publicState, setManager)

// Initialize plugin by checking for saved frame groups
async function initializePlugin() {
  try {
    const savedGroups = await loadAndValidateGroups()
    const validGroups = savedGroups.filter((g) => g.isValid)

    if (validGroups.length === 1) {
      // Auto-load the single valid group
      // Phase 1: Validate all frames into local variables before touching publicState
      const group = validGroups[0]

      // Validate annotation frame
      const annotationFrame = await figma.getNodeByIdAsync(
        group.annotationFrameId,
      )
      if (!annotationFrame || annotationFrame.type !== 'FRAME') {
        publicState.savedGroups = savedGroups
        publicState.view = 'setup'
        return
      }

      const annotationFrameRef = {
        type: annotationFrame.type,
        id: annotationFrame.id,
        name: annotationFrame.name,
      }

      // Validate info frame(s)
      let annotationInfoFrameRef: PublicState['frames']['annotationInfoFrame']

      if (typeof group.annotationInfoFrameId === 'string') {
        const infoFrame = await figma.getNodeByIdAsync(
          group.annotationInfoFrameId,
        )
        if (!infoFrame || infoFrame.type !== 'FRAME') {
          publicState.savedGroups = savedGroups
          publicState.view = 'setup'
          return
        }
        annotationInfoFrameRef = {
          type: infoFrame.type,
          id: infoFrame.id,
          name: infoFrame.name,
        }
      } else {
        const navFrame = await figma.getNodeByIdAsync(
          group.annotationInfoFrameId.navigation,
        )
        const notesFrame = await figma.getNodeByIdAsync(
          group.annotationInfoFrameId.notes,
        )
        if (
          !navFrame ||
          navFrame.type !== 'FRAME' ||
          !notesFrame ||
          notesFrame.type !== 'FRAME'
        ) {
          publicState.savedGroups = savedGroups
          publicState.view = 'setup'
          return
        }
        annotationInfoFrameRef = {
          navigation: {
            type: navFrame.type,
            id: navFrame.id,
            name: navFrame.name,
          },
          notes: {
            type: notesFrame.type,
            id: notesFrame.id,
            name: notesFrame.name,
          },
        }
      }

      // Validate annotation frame is on the current page
      const annotationFramePage = sceneUtils.findPageNode(
        annotationFrame as SceneNode,
      )
      if (
        !annotationFramePage ||
        annotationFramePage.id !== figma.currentPage.id
      ) {
        publicState.savedGroups = savedGroups
        publicState.view = savedGroups.length > 1 ? 'saved-groups' : 'setup'
        return
      }

      // Phase 2: All validation passed, commit to publicState atomically.
      publicState.mode = group.mode
      publicState.frames.annotationFrame = annotationFrameRef
      publicState.frames.annotationInfoFrame = annotationInfoFrameRef

      // Create and initialize the annotation state manager
      const manager = new AnnotationStateManager(
        group.annotationFrameId,
        group.annotationInfoFrameId,
        (annotations) => {
          messenger.notify('annotations-changed', annotations)
        },
        (mergedInfoGroups) => {
          messenger.notify('debug-info-changed', { mergedInfoGroups })
        },
      )

      await manager.initialize(annotationFramePage)
      setManager(manager)

      // Sync lock state from manager
      publicState.lockState = manager.currentLockState

      // Set annotation type based on mode
      publicState.annotationType =
        publicState.mode === 'mobile' ? 'note' : 'tab'
      publicState.savedGroups = savedGroups
      publicState.view = 'annotation'
    } else if (savedGroups.length > 0) {
      // Multiple groups - show selection UI
      publicState.savedGroups = savedGroups
      publicState.view = 'saved-groups'
    } else {
      // No saved groups - show setup
      publicState.view = 'setup'
    }
  } catch (error) {
    console.error('Failed to initialize plugin:', error)
    publicState.frames = { annotationFrame: null, annotationInfoFrame: null }
    publicState.view = 'setup'
  }
}

// Run initialization
initializePlugin()

// Simple state/data handlers that don't need extraction
messenger.on('get-state', () => {
  return publicState
})

messenger.on('get-annotations', (): AnnotationRecord[] => {
  if (!annotationStateManager) {
    return []
  }
  return annotationStateManager.annotations
})

// Exported for testing
export function getState(): PublicState {
  return publicState
}

export function getAnnotations(): AnnotationRecord[] {
  if (!annotationStateManager) {
    return []
  }
  return annotationStateManager.annotations
}
