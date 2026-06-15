import type { FigmaMessageHandler } from '@src/message-handler'
import type { PublicState, ValidatedFrameGroup } from '@src/types'
import {
  loadAndValidateGroups,
  deleteGroup as deleteGroupFromStorage,
  renameGroup as renameGroupFromStorage,
} from '../storage/frame-group-storage'
import { AnnotationStateManager } from '../annotation-state-manager'
import sceneUtils from '../scene-utils'

type ManagerSetter = (manager: AnnotationStateManager | null) => void
export function registerSavedGroupsHandlers(
  messenger: FigmaMessageHandler,
  publicState: PublicState,
  setManager: ManagerSetter,
): void {
  messenger.on('get-saved-groups', () => getSavedGroups(publicState))

  messenger.on('load-saved-group', (groupId) =>
    loadSavedGroup(groupId, messenger, publicState, setManager),
  )

  messenger.on('delete-saved-group', (groupId) =>
    deleteSavedGroup(groupId, publicState),
  )

  messenger.on('rename-saved-group', (groupId, newName) =>
    renameSavedGroup(groupId, newName, publicState),
  )

  messenger.on('skip-to-frame-selection', () =>
    skipToFrameSelection(publicState),
  )
}

/** Loads and validates saved groups, updating public state */
export async function getSavedGroups(
  publicState: PublicState,
): Promise<{ groups: ValidatedFrameGroup[] } | { error: string }> {
  try {
    const groups = await loadAndValidateGroups()
    publicState.savedGroups = groups
    return { groups }
  } catch (error) {
    console.error('Failed to load saved groups:', error)
    return { error: 'Failed to load saved configurations' }
  }
}

/** Loads a saved group and starts annotation mode */
export async function loadSavedGroup(
  groupId: string,
  messenger: FigmaMessageHandler,
  publicState: PublicState,
  setManager: ManagerSetter,
): Promise<{ success: boolean } | { error: string }> {
  const group = publicState.savedGroups.find((g) => g.id === groupId)
  if (!group) {
    return { error: 'Configuration not found' }
  }

  try {
    // Fresh validation — don't trust stale isValid from publicState
    const annotationFrame = await figma.getNodeByIdAsync(
      group.annotationFrameId,
    )
    if (!annotationFrame) {
      return { error: 'Annotation frame has been deleted' }
    }
    if (annotationFrame.type !== 'FRAME') {
      return { error: 'Annotation frame is no longer a frame' }
    }

    // Verify annotation frame is on the current page
    const annotationFramePage = sceneUtils.findPageNode(
      annotationFrame as SceneNode,
    )
    if (!annotationFramePage) {
      return { error: 'Annotation frame is not attached to any page' }
    }
    if (annotationFramePage.id !== figma.currentPage.id) {
      return {
        error:
          'Annotation frame is on a different page. Navigate to the correct page and try again.',
      }
    }

    // Restore mode
    publicState.mode = group.mode

    // Setup frame references
    publicState.frames.annotationFrame = {
      type: annotationFrame.type,
      id: annotationFrame.id,
      name: annotationFrame.name,
    }

    // Setup info frame references
    if (typeof group.annotationInfoFrameId === 'string') {
      const infoFrame = await figma.getNodeByIdAsync(
        group.annotationInfoFrameId,
      )
      if (!infoFrame) {
        return { error: 'Info frame has been deleted' }
      }
      if (infoFrame.type !== 'FRAME') {
        return { error: 'Info frame is no longer a frame' }
      }
      const infoPage = sceneUtils.findPageNode(infoFrame as SceneNode)
      if (!infoPage || infoPage.id !== figma.currentPage.id) {
        return {
          error:
            'Info frame is on a different page. Navigate to the correct page and try again.',
        }
      }
      publicState.frames.annotationInfoFrame = {
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
      if (!navFrame || !notesFrame) {
        return { error: 'One or more info frames have been deleted' }
      }
      if (navFrame.type !== 'FRAME' || notesFrame.type !== 'FRAME') {
        return { error: 'One or more info frames are no longer frames' }
      }
      const navPage = sceneUtils.findPageNode(navFrame as SceneNode)
      const notesPage = sceneUtils.findPageNode(notesFrame as SceneNode)
      if (
        !navPage ||
        navPage.id !== figma.currentPage.id ||
        !notesPage ||
        notesPage.id !== figma.currentPage.id
      ) {
        return {
          error:
            'Info frames are on a different page. Navigate to the correct page and try again.',
        }
      }
      publicState.frames.annotationInfoFrame = {
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

    // Create and initialize the annotation state manager
    const annotationFrameId = group.annotationFrameId
    const annotationInfoFrameId = group.annotationInfoFrameId

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

    // Set annotation type based on mode
    publicState.annotationType = publicState.mode === 'mobile' ? 'note' : 'tab'
    publicState.view = 'annotation'

    return { success: true }
  } catch (error) {
    console.error('Failed to load saved group:', error)
    return {
      error:
        error instanceof Error ? error.message : 'Failed to load configuration',
    }
  }
}

/** Deletes a saved group */
export async function deleteSavedGroup(
  groupId: string,
  publicState: PublicState,
): Promise<{ success: boolean } | { error: string }> {
  try {
    const deleted = deleteGroupFromStorage(groupId)
    if (!deleted) {
      return { error: 'Configuration not found' }
    }

    // Update public state
    publicState.savedGroups = publicState.savedGroups.filter(
      (g) => g.id !== groupId,
    )

    return { success: true }
  } catch (error) {
    console.error('Failed to delete saved group:', error)
    return { error: 'Failed to delete configuration' }
  }
}

/** Renames a saved group */
export async function renameSavedGroup(
  groupId: string,
  newName: string,
  publicState: PublicState,
): Promise<{ success: boolean } | { error: string }> {
  try {
    const renamed = renameGroupFromStorage(groupId, newName)
    if (!renamed) {
      return { error: 'Configuration not found' }
    }

    // Update public state
    const group = publicState.savedGroups.find((g) => g.id === groupId)
    if (group) {
      group.name = newName
    }

    return { success: true }
  } catch (error) {
    console.error('Failed to rename saved group:', error)
    return { error: 'Failed to rename configuration' }
  }
}

/** Skips saved groups and goes directly to frame selection */
export function skipToFrameSelection(publicState: PublicState): {
  success: boolean
} {
  publicState.frames = {
    annotationFrame: null,
    annotationInfoFrame: null,
  }
  publicState.view = 'setup'
  return { success: true }
}
