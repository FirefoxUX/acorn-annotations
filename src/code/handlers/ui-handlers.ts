import type { FigmaMessageHandler } from '@src/message-handler'
import type { LockState, PublicState } from '@src/types'
import {
  SIDEBAR_WIDTH,
  MIN_MAIN_WIDTH,
  MAX_MAIN_WIDTH,
  MIN_HEIGHT,
  DEFAULT_MAIN_WIDTH,
  DEFAULT_HEIGHT,
} from '@src/defaults'
import type { AnnotationStateManager } from '../annotation-state-manager'

type ManagerGetter = () => AnnotationStateManager | null

// Tracked window dimensions (updated by resize handler, used by toggleSidebar)
let currentMainWidth = DEFAULT_MAIN_WIDTH
let currentHeight = DEFAULT_HEIGHT
let saveTimeout: ReturnType<typeof setTimeout> | null = null

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function debouncedSaveSize(): void {
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(() => {
    figma.clientStorage
      .setAsync('windowSize', {
        mainWidth: currentMainWidth,
        height: currentHeight,
      })
      .catch(() => {})
  }, 500)
}

export function registerUIHandlers(
  messenger: FigmaMessageHandler,
  publicState: PublicState,
  getManager: ManagerGetter,
  handleError: (error: unknown, operation: string) => { error: string },
): void {
  messenger.on('select-scene-node', (id) => selectSceneNode(id))

  messenger.on('toggle-sidebar', (view) => toggleSidebar(publicState, view))

  messenger.on('toggle-lock-annotations', () =>
    toggleLockAnnotations(publicState, getManager, handleError),
  )

  messenger.on('set-lock-state', (state) =>
    setLockState(publicState, getManager, handleError, state),
  )

  messenger.on('open-external-link', (url) =>
    openExternalLink(handleError, url),
  )

  messenger.on('get-debug-info', () => getDebugInfo(getManager))

  messenger.on('resize-window', (data) => handleWindowResize(publicState, data))
}

export async function selectSceneNode(id: string) {
  // try to select the node with the given id
  const node = await figma.getNodeByIdAsync(id)
  if (node && 'visible' in node) {
    figma.currentPage.selection = [node as SceneNode]
    figma.viewport.scrollAndZoomIntoView([node as SceneNode])
    return { success: true }
  }
  return { error: `Node not found or is not a selectable node` }
}

export async function toggleSidebar(
  publicState: PublicState,
  view: 'help' | 'debug' | null = null,
): Promise<{
  success: boolean
  error?: string
  sidebar?: 'help' | 'debug' | null
}> {
  try {
    // If the view is already active, close the sidebar
    if (publicState.sidebar === view && view !== null) {
      publicState.sidebar = null
    } else {
      // Otherwise set the sidebar to the requested view
      publicState.sidebar = view
    }

    // Adjust the UI size based on the sidebar state
    const sidebarOffset = publicState.sidebar ? SIDEBAR_WIDTH : 0
    figma.ui.resize(currentMainWidth + sidebarOffset, currentHeight)

    return {
      success: true,
      sidebar: publicState.sidebar,
    }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to toggle sidebar',
    }
  }
}

export async function toggleLockAnnotations(
  publicState: PublicState,
  getManager: ManagerGetter,
  handleError: (error: unknown, operation: string) => { error: string },
): Promise<{
  success: boolean
  error?: string
  lockState?: LockState
}> {
  const manager = getManager()
  if (!manager) {
    return {
      success: false,
      error:
        'Annotation state manager not initialized. Please start annotation mode first.',
    }
  }

  try {
    // Cycle: all-unlocked -> design-locked -> annotations-locked -> all-unlocked
    const currentState = manager.currentLockState
    const nextState: LockState =
      currentState === 'all-unlocked'
        ? 'design-locked'
        : currentState === 'design-locked'
          ? 'annotations-locked'
          : 'all-unlocked'

    await manager.setLockState(nextState)
    publicState.lockState = nextState
    figma.commitUndo()
    return {
      success: true,
      lockState: nextState,
    }
  } catch (error) {
    const result = handleError(error, 'toggle annotation lock state')
    return {
      success: false,
      error: result.error,
    }
  }
}

export async function setLockState(
  publicState: PublicState,
  getManager: ManagerGetter,
  handleError: (error: unknown, operation: string) => { error: string },
  state: LockState,
): Promise<{
  success: boolean
  error?: string
  lockState?: LockState
}> {
  const manager = getManager()
  if (!manager) {
    return {
      success: false,
      error:
        'Annotation state manager not initialized. Please start annotation mode first.',
    }
  }

  try {
    await manager.setLockState(state)
    publicState.lockState = state
    figma.commitUndo()
    return {
      success: true,
      lockState: state,
    }
  } catch (error) {
    const result = handleError(error, 'set lock state')
    return {
      success: false,
      error: result.error,
    }
  }
}

export function openExternalLink(
  handleError: (error: unknown, operation: string) => { error: string },
  url: string,
): Promise<{
  success: boolean
  error?: string
}> {
  try {
    // Use Figma's API to open external links
    figma.openExternal(url)
    return Promise.resolve({
      success: true,
    })
  } catch (error) {
    const result = handleError(error, 'open external link')
    return Promise.resolve({
      success: false,
      error: result.error,
    })
  }
}

export function getDebugInfo(getManager: ManagerGetter) {
  const manager = getManager()
  if (!manager) {
    return {
      mergedInfoGroups: [],
      managerFrames: null,
      error: 'Annotation state manager not initialized',
    }
  }

  // Get data using the public getters
  // Convert Set objects to arrays for JSON serialization
  const rawMergedInfoGroups = manager.mergedInfoGroups || []
  const mergedInfoGroups = rawMergedInfoGroups.map((group) => ({
    infoNodeId: group.infoNodeId,
    hash: group.hash,
    references: Array.from(group.references || []),
  }))

  return {
    annotations: manager.annotations,
    mergedInfoGroups: mergedInfoGroups,
    // Frame IDs the state manager actually writes to. Useful for spotting
    // drift between publicState.frames (what the UI thinks) and what the
    // plugin is using under the hood (e.g. after a desktop→mobile mode
    // switch the manager's frame ref is frozen at construction time).
    managerFrames: {
      annotationFrameId: manager.annotationFrameId,
      annotationInfoFrameId: manager.annotationInfoFrameId,
    },
    success: true,
  }
}

export function handleWindowResize(
  publicState: PublicState,
  data: { mainWidth: number; height: number },
): void {
  currentMainWidth = clamp(data.mainWidth, MIN_MAIN_WIDTH, MAX_MAIN_WIDTH)
  currentHeight = clamp(data.height, MIN_HEIGHT, 2000)

  const sidebarOffset = publicState.sidebar ? SIDEBAR_WIDTH : 0
  figma.ui.resize(currentMainWidth + sidebarOffset, currentHeight)
  debouncedSaveSize()
}

export async function restoreWindowSize(
  publicState: PublicState,
): Promise<void> {
  try {
    const saved = (await figma.clientStorage.getAsync('windowSize')) as
      | { mainWidth: number; height: number }
      | undefined

    if (
      saved &&
      typeof saved.mainWidth === 'number' &&
      typeof saved.height === 'number'
    ) {
      currentMainWidth = clamp(saved.mainWidth, MIN_MAIN_WIDTH, MAX_MAIN_WIDTH)
      currentHeight = clamp(saved.height, MIN_HEIGHT, 2000)
    }

    const sidebarOffset = publicState.sidebar ? SIDEBAR_WIDTH : 0
    figma.ui.resize(currentMainWidth + sidebarOffset, currentHeight)
  } catch {
    // Ignore storage errors, use defaults
  }
}
