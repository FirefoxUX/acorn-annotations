import type { FigmaMessageHandler } from '@src/message-handler'
import type { PublicState, SceneNodeReference } from '@src/types'
import { AnnotationStateManager } from '../annotation-state-manager'
import sceneUtils from '../scene-utils'
import {
  saveGroup,
  loadAndValidateGroups,
} from '../storage/frame-group-storage'

type ManagerGetter = () => AnnotationStateManager | null
type ManagerSetter = (manager: AnnotationStateManager | null) => void

export function registerFrameHandlers(
  messenger: FigmaMessageHandler,
  publicState: PublicState,
  getManager: ManagerGetter,
  setManager: ManagerSetter,
  handleError: (error: unknown, operation: string) => { error: string },
): void {
  messenger.on('set-frame', (kind) => setFrame(publicState, kind))

  messenger.on('create-info-frame', () =>
    createInfoFrame(publicState, handleError),
  )

  messenger.on('start-annotation', () =>
    startAnnotation(messenger, publicState, setManager),
  )

  messenger.on('return-to-frame-selection', () =>
    returnToFrameSelection(
      messenger,
      publicState,
      getManager,
      setManager,
      handleError,
    ),
  )
}

export function setFrame(
  publicState: PublicState,
  kind: 'annotation' | 'info' | 'info-navigation' | 'info-notes',
) {
  // get current selection
  const selection = figma.currentPage.selection
  if (selection.length === 0)
    return {
      error: 'No selection. Please select a single frame.',
    }
  if (selection.length > 1)
    return {
      error: 'Multiple frames selected. Please select a single frame.',
    }
  const frame = selection[0]
  if (frame.type !== 'FRAME') {
    return {
      error: 'Selected node is not a frame. Please select a frame.',
    }
  }

  if (kind === 'annotation' && (frame as FrameNode).layoutMode !== 'NONE') {
    return {
      error:
        'The selected frame has auto layout applied. Please choose a wrapper frame without auto layout so annotations can be positioned freely.',
    }
  }

  if (kind !== 'annotation' && (frame as FrameNode).layoutMode === 'NONE') {
    return {
      error:
        'The selected info frame must have auto layout applied so annotation entries can stack vertically.',
    }
  }

  const frameRef: SceneNodeReference = {
    type: frame.type,
    id: frame.id,
    name: frame.name,
  }
  switch (kind) {
    case 'annotation':
      publicState.frames.annotationFrame = frameRef
      break
    case 'info':
      publicState.frames.annotationInfoFrame = frameRef
      break
    case 'info-navigation':
      if (
        !publicState.frames.annotationInfoFrame ||
        typeof publicState.frames.annotationInfoFrame !== 'object' ||
        !('navigation' in publicState.frames.annotationInfoFrame)
      ) {
        return {
          error: 'No info frame set. Please set an info frame first.',
        }
      }
      publicState.frames.annotationInfoFrame.navigation = frameRef
      break
    case 'info-notes':
      if (
        !publicState.frames.annotationInfoFrame ||
        typeof publicState.frames.annotationInfoFrame !== 'object' ||
        !('notes' in publicState.frames.annotationInfoFrame)
      ) {
        return {
          error: 'No info frame set. Please set an info frame first.',
        }
      }
      publicState.frames.annotationInfoFrame.notes = frameRef
      break
  }
  return {
    success: true,
    frame: frameRef,
  }
}

export async function createInfoFrame(
  publicState: PublicState,
  handleError: (error: unknown, operation: string) => { error: string },
): Promise<{
  success: boolean
  error?: string
  frame?: SceneNodeReference
}> {
  try {
    // Create a new frame
    const frame = figma.createFrame()
    frame.name = 'Annotation info'
    frame.resize(356, 256)

    // Apply auto layout
    frame.layoutMode = 'VERTICAL'
    frame.primaryAxisSizingMode = 'AUTO'
    frame.counterAxisSizingMode = 'FIXED'
    frame.itemSpacing = 8
    frame.paddingLeft = 8
    frame.paddingRight = 8
    frame.paddingTop = 8
    frame.paddingBottom = 8

    // Position the frame in the viewport
    const viewport = figma.viewport.center
    frame.x = viewport.x
    frame.y = viewport.y

    // Create a frame reference
    const frameRef: SceneNodeReference = {
      type: frame.type,
      id: frame.id,
      name: frame.name,
    }

    if (publicState.frames.annotationInfoFrame === null) {
      publicState.frames.annotationInfoFrame = frameRef
    } else if (
      'navigation' in publicState.frames.annotationInfoFrame &&
      publicState.frames.annotationInfoFrame.navigation === null
    ) {
      publicState.frames.annotationInfoFrame.navigation = frameRef
    }

    // Select the newly created frame
    figma.currentPage.selection = [frame]
    figma.viewport.scrollAndZoomIntoView([frame])

    return {
      success: true,
      frame: frameRef,
    }
  } catch (error) {
    const result = handleError(error, 'create info frame')
    return {
      success: false,
      error: result.error,
    }
  }
}

export async function startAnnotation(
  messenger: FigmaMessageHandler,
  publicState: PublicState,
  setManager: ManagerSetter,
) {
  try {
    // Check if annotation frame exists
    if (!publicState.frames.annotationFrame) {
      return {
        error:
          'No annotation frame set. Please select an annotation frame first.',
      }
    }

    // Check if annotation info frame exists
    if (!publicState.frames.annotationInfoFrame) {
      return {
        error:
          'No annotation info frame set. Please select an annotation info frame first.',
      }
    }

    // if annotationInfoFrameId is split, check if both frames are set and not the same
    if ('navigation' in publicState.frames.annotationInfoFrame) {
      const { navigation, notes } = publicState.frames.annotationInfoFrame
      if (!navigation || !notes) {
        return {
          error:
            'Both navigation and notes frames must be set when using a split info frame.',
        }
      }
      if (navigation.id === notes.id) {
        return {
          error:
            'Navigation and notes frames must be different when using a split info frame.',
        }
      }
    }

    // Initialize the annotation state manager
    const annotationFrameId = publicState.frames.annotationFrame.id
    let annotationInfoFrameId: string | { navigation: string; notes: string }

    if ('id' in publicState.frames.annotationInfoFrame) {
      // Single info frame
      annotationInfoFrameId = publicState.frames.annotationInfoFrame.id
    } else {
      // Split info frame
      annotationInfoFrameId = {
        navigation: publicState.frames.annotationInfoFrame.navigation?.id || '',
        notes: publicState.frames.annotationInfoFrame.notes?.id || '',
      }
    }

    // get the page of the annotationFrame
    const annotationFrame = (await figma.getNodeByIdAsync(
      annotationFrameId,
    )) as FrameNode | null
    if (!annotationFrame) {
      throw new Error('Annotation frame not found!')
    }
    const annotationFramePage = sceneUtils.findPageNode(annotationFrame)
    if (!annotationFramePage) {
      throw new Error('Annotation frame page not found!')
    }

    const manager = new AnnotationStateManager(
      annotationFrameId,
      annotationInfoFrameId,
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

    // In desktop mode the default mode is tab, in mobile mode it's note
    if (publicState.mode === 'mobile') {
      publicState.annotationType = 'note'
    } else {
      publicState.annotationType = 'tab'
    }

    // Save this frame group configuration for quick access next time
    const frameName = publicState.frames.annotationFrame.name || 'Untitled'
    saveGroup(
      frameName,
      publicState.mode,
      annotationFrameId,
      annotationInfoFrameId,
    )

    // Set the view to annotation mode
    publicState.view = 'annotation'

    return { success: true }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to start annotation mode'
    console.error('Failed to start annotation mode:', error)
    return { error: errorMessage }
  }
}

export async function returnToFrameSelection(
  messenger: FigmaMessageHandler,
  publicState: PublicState,
  getManager: ManagerGetter,
  setManager: ManagerSetter,
  handleError: (error: unknown, operation: string) => { error: string },
): Promise<{
  success: boolean
  error?: string
}> {
  try {
    // Clean up the annotation state manager
    const manager = getManager()
    if (manager) {
      manager.uninitialize()
      setManager(null)
    }

    // Reset the frames state
    publicState.frames = {
      ...publicState.frames,
      annotationFrame: null,
      annotationInfoFrame: null,
    }

    messenger.notify('annotations-changed', [])

    // Check for saved groups and navigate accordingly
    const savedGroups = await loadAndValidateGroups()
    publicState.savedGroups = savedGroups

    if (savedGroups.length > 0) {
      publicState.view = 'saved-groups'
    } else {
      publicState.view = 'setup'
    }

    return { success: true }
  } catch (error) {
    const result = handleError(error, 'return to frame selection')
    return {
      success: false,
      error: result.error,
    }
  }
}
