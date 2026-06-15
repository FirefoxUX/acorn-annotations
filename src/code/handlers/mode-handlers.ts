import type { FigmaMessageHandler } from '@src/message-handler'
import type { AnnotationKind, PublicState } from '@src/types'

export function registerModeHandlers(
  messenger: FigmaMessageHandler,
  publicState: PublicState,
): void {
  messenger.on('set-mode', (mode) => setMode(publicState, mode))

  messenger.on('set-annotation-type', (type) =>
    setAnnotationType(publicState, type),
  )

  messenger.on('set-annotation-mode', (mode) =>
    setAnnotationMode(publicState, mode),
  )

  messenger.on('set-split-info-frame', (split) =>
    setSplitInfoFrame(publicState, split),
  )

  messenger.on('set-selection-grouping', (value) =>
    setSelectionGrouping(publicState, value),
  )
}

export function setMode(publicState: PublicState, mode: 'desktop' | 'mobile') {
  publicState.mode = mode

  // When switching to mobile, automatically unsplit the info frame
  if (mode === 'mobile') {
    setSplitInfoFrame(publicState, false)
  }

  return {
    success: true,
    mode,
  }
}

export function setAnnotationType(
  publicState: PublicState,
  type: AnnotationKind,
) {
  // Simply update the annotation type - position-based IDs handle reference assignment
  publicState.annotationType = type

  return {
    success: true,
    type,
  }
}

export function setAnnotationMode(
  publicState: PublicState,
  mode: 'displace-group' | 'displace-multi',
) {
  publicState.annotationMode = mode
  return {
    success: true,
    mode,
  }
}

export function setSelectionGrouping(
  publicState: PublicState,
  value: 'entire' | 'individual',
) {
  publicState.selectionGrouping = value
  return {
    success: true,
    value,
  }
}

export function setSplitInfoFrame(publicState: PublicState, split: boolean) {
  const currentInfoFrame = publicState.frames.annotationInfoFrame

  // Don't allow splitting in mobile mode
  if (split && publicState.mode === 'mobile') {
    return {
      error: 'Cannot split info frame in mobile mode',
      split: false,
    }
  }

  // Early return if we're already in the desired state
  if (
    (split &&
      currentInfoFrame &&
      typeof currentInfoFrame === 'object' &&
      'navigation' in currentInfoFrame) ||
    (!split && (currentInfoFrame === null || 'id' in currentInfoFrame))
  ) {
    return { success: true, split }
  }

  if (split) {
    // If the current frame is a SceneNodeReference, convert it to split format
    if (currentInfoFrame && 'id' in currentInfoFrame) {
      publicState.frames.annotationInfoFrame = {
        navigation: currentInfoFrame,
        notes: currentInfoFrame,
      }
    } else {
      // Initialize with null values
      publicState.frames.annotationInfoFrame = {
        navigation: null,
        notes: null,
      }
    }
  } else {
    // When unsplitting, use navigation frame or null
    const navigationFrame =
      currentInfoFrame &&
      typeof currentInfoFrame === 'object' &&
      'navigation' in currentInfoFrame
        ? currentInfoFrame.navigation
        : null

    publicState.frames.annotationInfoFrame = navigationFrame
  }

  return { success: true, split }
}
