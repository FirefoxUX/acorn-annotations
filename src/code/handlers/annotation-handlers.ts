import type { FigmaMessageHandler } from '@src/message-handler'
import type { AnnotationKind, AnnotationRecord, PublicState } from '@src/types'
import type { AnnotationStateManager } from '../annotation-state-manager'
import sceneUtils from '../scene-utils'
import { findByFigmaKey } from '@src/component-map'

type ManagerGetter = () => AnnotationStateManager | null

export function registerAnnotationHandlers(
  messenger: FigmaMessageHandler,
  publicState: PublicState,
  getManager: ManagerGetter,
  handleError: (error: unknown, operation: string) => { error: string },
  updateSelectedReference: (setNull?: boolean) => Promise<void>,
  _getLastAnnotationType: () => AnnotationKind | null,
  setLastAnnotationType: (type: AnnotationKind | null) => void,
): void {
  messenger.on('create-annotation', (multi, padding) =>
    createAnnotationFromSelection(
      publicState,
      getManager,
      handleError,
      multi,
      padding,
      setLastAnnotationType,
    ),
  )

  messenger.on('add-to-annotation', (strReference, multi, padding) =>
    addToAnnotationFromSelection(
      publicState,
      getManager,
      handleError,
      strReference,
      multi,
      padding,
    ),
  )

  messenger.on('delete-annotation', (strReference) =>
    deleteAnnotation(
      getManager,
      handleError,
      updateSelectedReference,
      strReference,
    ),
  )

  messenger.on('delete-multiple-annotations', (strReferences) =>
    deleteMultipleAnnotations(
      getManager,
      handleError,
      updateSelectedReference,
      strReferences,
    ),
  )

  messenger.on(
    'update-multiple-annotations',
    (strReferences, updatedAnnotation, newReference) =>
      updateMultipleAnnotations(
        getManager,
        handleError,
        strReferences,
        updatedAnnotation,
        newReference,
      ),
  )

  messenger.on('merge-annotation', (sourceRef, targetRef) =>
    mergeAnnotation(getManager, handleError, sourceRef, targetRef),
  )

  messenger.on('regroup-annotations', () =>
    regroupAnnotations(getManager, handleError),
  )

  messenger.on(
    'reorder-annotation-by-index',
    (currentStrReference, position, targetIndex) =>
      reorderAnnotationByIndex(
        getManager,
        handleError,
        currentStrReference,
        position,
        targetIndex,
      ),
  )

  messenger.on(
    'reorder-multiple-annotations-by-index',
    (references, position, targetIndex) =>
      reorderMultipleAnnotationsByIndex(
        getManager,
        handleError,
        references,
        position,
        targetIndex,
      ),
  )

  messenger.on('select-annotation-markers', (strReference) =>
    selectAnnotationMarkers(getManager, handleError, strReference),
  )
}

export async function createAnnotationFromSelection(
  publicState: PublicState,
  getManager: ManagerGetter,
  handleError: (error: unknown, operation: string) => { error: string },
  multi: boolean,
  padding: boolean,
  setLastAnnotationType: (type: AnnotationKind | null) => void,
) {
  // Validate preconditions
  const validation = await validateAnnotationPreconditions(
    publicState,
    getManager,
  )
  if (validation.error) {
    return { error: validation.error }
  }

  const appendFrame = validation.appendFrame!
  const annotationType = publicState.annotationType

  // Capture selection before processAnnotations (which may alter it)
  const selectedNodes = [...figma.currentPage.selection]

  try {
    // Determine behavior based on annotation mode
    // 'displace-group' = one reference for all selected, 'displace-multi' = unique reference per selection
    const useSameReference =
      publicState.annotationMode === 'displace-group' ||
      annotationType === 'arrow'

    // For single/entire path: auto-switch note → component-note if component detected
    // Skip when grouped mode spans multiple nodes — the user is annotating a group, not an individual component
    let effectiveType = annotationType
    const isGroupedMultipleNodes = !multi && selectedNodes.length > 1
    if (!multi && !isGroupedMultipleNodes && annotationType === 'note') {
      const detected = await detectComponentName(selectedNodes)
      if (detected) effectiveType = 'component-note'
    }

    // Process annotations using our helper function
    // Position-based reference calculation handles shifting automatically
    const createdAnnotations = await processAnnotations(
      publicState,
      getManager()!,
      multi,
      padding,
      effectiveType,
      appendFrame,
      undefined, // No strReference, we'll generate one based on position
      false, // Shifting is handled inside processAnnotations now
      false, // addToExisting is handled via 'add-to-annotation' message
      useSameReference,
    )

    // For multi + note: per-node detection, switch individual notes to component-note
    if (multi && annotationType === 'note') {
      const sortedNodes = [...selectedNodes].sort((a, b) => {
        const yDiff = a.y - b.y
        return Math.abs(yDiff) <= 20 ? a.x - b.x : yDiff
      })
      for (let i = 0; i < createdAnnotations.length; i++) {
        const record = createdAnnotations[i]
        const node = sortedNodes[i]
        if (record.kind !== 'note' || !node) continue
        const name = await detectComponentNameForNode(node)
        if (name) {
          try {
            await getManager()!.editAnnotation(record.strReference, {
              newKind: 'component-note',
              properties: { componentName: name, showComponentName: true },
            })
          } catch {
            // Non-critical: annotation was still created successfully
          }
        }
      }
    }

    // Detect component name and stamp on created records
    // Skip when grouped mode spans multiple nodes — the annotation covers a group, not an individual component
    if (multi) {
      // Per-node detection: each annotation gets its own component's name (or none)
      const sortedNodes = [...selectedNodes].sort((a, b) => {
        const yDiff = a.y - b.y
        return Math.abs(yDiff) <= 20 ? a.x - b.x : yDiff
      })
      for (let i = 0; i < createdAnnotations.length; i++) {
        const record = createdAnnotations[i]
        const node = sortedNodes[i]
        if (!node) continue
        if (
          record.kind !== 'tab' &&
          record.kind !== 'arrow' &&
          record.kind !== 'component-note'
        )
          continue
        const name = await detectComponentNameForNode(node)
        if (name) {
          try {
            await getManager()!.editAnnotation(record.strReference, {
              properties: { componentName: name, showComponentName: true },
            })
          } catch {
            // Non-critical: annotation was still created successfully
          }
        }
      }
    } else if (!isGroupedMultipleNodes) {
      // Single node (or entire-as-one with 1 node): detect from all selected
      const detectedName = await detectComponentName(selectedNodes)
      if (detectedName) {
        for (const record of createdAnnotations) {
          if (
            record.kind === 'tab' ||
            record.kind === 'arrow' ||
            record.kind === 'component-note'
          ) {
            try {
              await getManager()!.editAnnotation(record.strReference, {
                properties: {
                  componentName: detectedName,
                  showComponentName: true,
                },
              })
            } catch {
              // Non-critical: annotation was still created successfully
            }
          }
        }
      }
    }

    setLastAnnotationType(annotationType)
    figma.commitUndo()

    return { success: true, records: createdAnnotations }
  } catch (error) {
    return handleError(error, 'create annotations')
  }
}

export async function addToAnnotationFromSelection(
  publicState: PublicState,
  getManager: ManagerGetter,
  handleError: (error: unknown, operation: string) => { error: string },
  strReference: string,
  multi: boolean,
  padding: boolean,
) {
  // Validate preconditions
  const validation = await validateAnnotationPreconditions(
    publicState,
    getManager,
  )
  if (validation.error) {
    return handleError(validation.error, 'adding to annotation')
  }

  const appendFrame = validation.appendFrame!
  const manager = getManager()!

  // Find the existing annotation
  const existingAnnotation = manager.findAnnotationByStrReference(strReference)

  if (!existingAnnotation) {
    return handleError('Annotation not found', 'adding to annotation')
  }

  try {
    await processAnnotations(
      publicState,
      manager,
      multi,
      padding,
      existingAnnotation.kind,
      appendFrame,
      existingAnnotation.strReference,
      false,
      true,
    )
    figma.commitUndo()

    return { success: true }
  } catch (error) {
    return handleError(error, 'adding to annotation')
  }
}

export async function deleteAnnotation(
  getManager: ManagerGetter,
  handleError: (error: unknown, operation: string) => { error: string },
  updateSelectedReference: (setNull?: boolean) => Promise<void>,
  strReference: string,
): Promise<{ success: boolean; error?: string }> {
  const manager = getManager()
  if (!manager) {
    return {
      success: false,
      error:
        'Annotation state manager not initialized. Please start annotation mode first.',
    }
  }

  try {
    const annotation = manager.findAnnotationByStrReference(strReference)
    const kind = annotation ? annotation.kind : undefined
    const success = await manager.removeAnnotation(strReference)

    if (success && kind) {
      await manager.shiftAnnotations(strReference, kind, 'down')
      updateSelectedReference()
    }

    figma.commitUndo()
    return {
      success,
    }
  } catch (error) {
    const result = handleError(error, 'delete annotation')
    return {
      success: false,
      error: result.error,
    }
  }
}

export async function deleteMultipleAnnotations(
  getManager: ManagerGetter,
  handleError: (error: unknown, operation: string) => { error: string },
  updateSelectedReference: (setNull?: boolean) => Promise<void>,
  strReferences: string[],
): Promise<{
  success: boolean
  error?: string
  results?: { success: string[]; failed: string[] }
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
    await manager.bulkDeleteAnnotations(strReferences)

    // Update the selected reference in case we just deleted the selected one
    updateSelectedReference()

    figma.commitUndo()
    return {
      success: true,
    }
  } catch (error) {
    const result = handleError(error, 'delete multiple annotations')
    return {
      success: false,
      error: result.error,
    }
  }
}

export async function updateMultipleAnnotations(
  getManager: ManagerGetter,
  handleError: (error: unknown, operation: string) => { error: string },
  strReferences: string[] | string,
  updatedAnnotation: AnnotationRecord,
  newReference?: string, // Optional: new reference for single annotation updates
): Promise<{
  success: boolean
  error?: string
  newReference?: string // Return the new reference if it changed
  results?: { success: string[]; failed: string[] }
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
    // Convert single string reference to array for unified processing
    const referencesArray = Array.isArray(strReferences)
      ? strReferences
      : [strReferences]

    // Reference changes only supported for single annotation updates
    const effectiveNewReference =
      referencesArray.length === 1 ? newReference : undefined

    // Extract properties from the updated annotation excluding base fields
    const {
      kind,
      annotationNodeId,
      strReference: ref,
      ...properties
    } = updatedAnnotation

    const successReferences: string[] = []
    const failedReferences: string[] = []
    // Capture rename when editAnnotation transitions kind across the
    // navigation/note boundary or tab↔arrow within navigation — those paths
    // change strReference without the UI passing newReference.
    let transitionRename: string | undefined

    for (const strReference of referencesArray) {
      try {
        // Check for marker split scenario: multi-marker annotation with reference change
        // where only SOME markers are selected in Figma
        if (effectiveNewReference && effectiveNewReference !== strReference) {
          const annotation = manager.findAnnotationByStrReference(strReference)
          if (annotation && annotation.annotationNodeId.length > 1) {
            const currentSelection = figma.currentPage.selection
            const selectedMarkerIds = new Set(
              currentSelection
                .filter((n) => n.type === 'INSTANCE')
                .map((n) => n.id),
            )
            const selectedInAnnotation = annotation.annotationNodeId.filter(
              (id) => selectedMarkerIds.has(id),
            )

            // If only some markers are selected, split them to new reference
            if (
              selectedInAnnotation.length > 0 &&
              selectedInAnnotation.length < annotation.annotationNodeId.length
            ) {
              // Remove selected markers from original annotation
              annotation.annotationNodeId = annotation.annotationNodeId.filter(
                (id) => !selectedMarkerIds.has(id),
              )

              // Find or create target annotation
              let targetAnnotation = manager.findAnnotationByStrReference(
                effectiveNewReference,
              )
              if (targetAnnotation) {
                // Add markers to existing target annotation
                targetAnnotation.annotationNodeId.push(...selectedInAnnotation)
              } else {
                // Create new annotation record directly with the split markers
                const newRecord: AnnotationRecord = {
                  ...updatedAnnotation,
                  kind: 'arrow', // Default to arrow for split-off markers
                  strReference: effectiveNewReference,
                  annotationNodeId: [...selectedInAnnotation],
                }
                // Copy properties from the source annotation
                if (properties) {
                  for (const [key, value] of Object.entries(properties)) {
                    ;(newRecord as Record<string, unknown>)[key] = value
                  }
                }
                manager.insertSortedAnnotation(newRecord)
                targetAnnotation = newRecord
              }

              successReferences.push(strReference)
              continue
            }
          }
        }

        // Standard path: use editAnnotation which handles all the complexity
        const editedRecord = await manager.editAnnotation(strReference, {
          newKind: kind,
          newReference: effectiveNewReference,
          properties,
        })
        if (
          referencesArray.length === 1 &&
          editedRecord.strReference !== strReference
        ) {
          transitionRename = editedRecord.strReference
        }
        successReferences.push(strReference)
      } catch (error) {
        console.error(`Failed to update annotation ${strReference}:`, error)
        failedReferences.push(strReference)
      }
    }

    // Single annotation case doesn't need detailed results
    if (!Array.isArray(strReferences)) {
      if (failedReferences.length > 0) {
        return {
          success: false,
          error: `Failed to update annotation: ${strReferences}`,
        }
      }
      figma.commitUndo()
      return {
        success: true,
        // Surface either an explicit rename (UI-driven) or an implicit one
        // from a kind transition so the UI can update its selection state.
        newReference: effectiveNewReference ?? transitionRename,
      }
    }

    // Return appropriate results for multi-annotation update
    figma.commitUndo()
    return {
      success: failedReferences.length === 0,
      results: {
        success: successReferences,
        failed: failedReferences,
      },
    }
  } catch (error) {
    const result = handleError(error, 'update annotations')
    return {
      success: false,
      error: result.error,
    }
  }
}

export async function mergeAnnotation(
  getManager: ManagerGetter,
  handleError: (error: unknown, operation: string) => { error: string },
  sourceRef: string,
  targetRef: string,
): Promise<{ success: boolean; error?: string }> {
  const manager = getManager()
  if (!manager) {
    return {
      success: false,
      error:
        'Annotation state manager not initialized. Please start annotation mode first.',
    }
  }

  try {
    await manager.mergeAnnotations(sourceRef, targetRef)

    // Commit the undo after a successful operation
    figma.commitUndo()

    return { success: true }
  } catch (error) {
    const result = handleError(error, 'merge annotations')
    return {
      success: false,
      error: result.error,
    }
  }
}

export async function regroupAnnotations(
  getManager: ManagerGetter,
  handleError: (error: unknown, operation: string) => { error: string },
): Promise<{
  success: boolean
  error?: string
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
    // Delegate to the AnnotationStateManager implementation
    await manager.regroupAnnotations()
    figma.commitUndo()

    return { success: true }
  } catch (error) {
    const result = handleError(error, 'regroup annotations')
    return {
      success: false,
      error: result.error,
    }
  }
}

export async function reorderAnnotationByIndex(
  getManager: ManagerGetter,
  handleError: (error: unknown, operation: string) => { error: string },
  currentStrReference: string,
  position: -1 | 0,
  targetIndex: number,
) {
  const manager = getManager()
  if (!manager) {
    return {
      error: 'Annotation state manager is not initialized',
    }
  }
  try {
    await manager.reorderAnnotationByIndex(
      currentStrReference,
      position,
      targetIndex,
    )
    figma.commitUndo()

    return { success: true }
  } catch (error) {
    return handleError(error, 'reorder annotation')
  }
}

export async function reorderMultipleAnnotationsByIndex(
  getManager: ManagerGetter,
  handleError: (error: unknown, operation: string) => { error: string },
  references: string[],
  position: -1 | 0,
  targetIndex: number,
) {
  const manager = getManager()
  if (!manager) {
    return {
      error: 'Annotation state manager is not initialized',
    }
  }
  try {
    await manager.reorderMultipleAnnotationsByIndex(
      references,
      position,
      targetIndex,
    )
    figma.commitUndo()

    return { success: true }
  } catch (error) {
    return handleError(error, 'reorder multiple annotations')
  }
}

export async function selectAnnotationMarkers(
  getManager: ManagerGetter,
  handleError: (error: unknown, operation: string) => { error: string },
  strReference: string,
): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const manager = getManager()
    if (!manager) {
      return {
        success: false,
        error: 'Annotation state manager not initialized',
      }
    }

    const record = manager.findAnnotationByStrReference(strReference)
    if (!record) {
      return { success: false, error: `Annotation ${strReference} not found` }
    }

    // Collect all annotation marker nodes using Promise.all for parallel processing
    const nodePromises = record.annotationNodeId.map((nodeId) =>
      figma.getNodeByIdAsync(nodeId),
    )
    const nodes = await Promise.all(nodePromises)

    // Filter valid SceneNodes (exclude null results and PAGE nodes)
    const markerNodes: SceneNode[] = nodes.filter(
      (node): node is SceneNode => node !== null && node.type !== 'PAGE',
    ) as SceneNode[]

    if (markerNodes.length === 0) {
      return {
        success: false,
        error: `No annotation markers found for ${strReference}`,
      }
    }

    // Set the selection to the marker nodes
    figma.currentPage.selection = markerNodes

    return { success: true }
  } catch (error) {
    const errorResult = handleError(
      error,
      `select annotation markers for ${strReference}`,
    )
    return { success: false, error: errorResult.error }
  }
}

// Helper functions

async function validateAnnotationPreconditions(
  publicState: PublicState,
  getManager: ManagerGetter,
): Promise<{
  error?: string
  appendFrame?: FrameNode
}> {
  const selection = figma.currentPage.selection

  // Check if we have selection
  if (selection.length === 0) {
    return { error: 'No elements selected' }
  }

  // Check if annotation state manager is initialized
  if (!getManager()) {
    return {
      error:
        'Annotation state manager not initialized. Please start annotation mode first.',
    }
  }

  if (!publicState.frames.annotationFrame) {
    return { error: 'Annotation frame not found' }
  }

  // Find the frame to append to
  const appendFrame = (await figma.getNodeByIdAsync(
    publicState.frames.annotationFrame.id,
  )) as FrameNode | null

  if (!appendFrame || appendFrame.type !== 'FRAME') {
    return { error: 'Append frame not found or is not a frame' }
  }

  // Validate that all selected elements are within appendFrame
  const validation = sceneUtils.validateNodesWithinFrame(selection, appendFrame)
  if (!validation.isValid) {
    return {
      error: `Selected elements must be nested within the annotation frame. ${validation.invalidNodes.length} element(s) are outside the frame.`,
    }
  }

  return { appendFrame }
}

function calculatePositionAndSize(
  multi: boolean,
  padding: boolean,
  appendFrame: FrameNode,
  node?: SceneNode,
): { position: [number, number]; size: [number, number] } {
  if (multi && node) {
    // Calculate position and size for a single node
    const nodePosition = sceneUtils.getRelativePosition(node, appendFrame)
    const position: [number, number] = [nodePosition.x, nodePosition.y]
    const size: [number, number] = [node.width, node.height]

    // Apply padding if needed
    if (padding) {
      position[0] -= 8
      position[1] -= 8
      size[0] += 16
      size[1] += 16
    }

    return { position, size }
  } else {
    // Calculate bounding box for all selected elements
    const selection = figma.currentPage.selection
    const boundingBox = sceneUtils.calculateBoundingBox(selection, appendFrame)
    const position: [number, number] = [boundingBox.minX, boundingBox.minY]
    const size: [number, number] = [boundingBox.width, boundingBox.height]

    // Apply padding if needed (different padding values for group)
    if (padding) {
      position[0] -= 8
      position[1] -= 8
      size[0] += 16
      size[1] += 16
    }

    return { position, size }
  }
}

async function processAnnotations(
  _publicState: PublicState,
  manager: AnnotationStateManager,
  multi: boolean,
  padding: boolean,
  annotationType: AnnotationKind,
  appendFrame: FrameNode,
  strReference?: string,
  _shouldShift = false,
  addToExisting = false,
  useSameReference = false,
): Promise<AnnotationRecord[]> {
  const selection = figma.currentPage.selection
  const createdAnnotations: AnnotationRecord[] = []

  // Helper: for arrow mode, the first annotation in a group is kind='tab'
  function getEffectiveKind(
    baseKind: AnnotationKind,
    isFirstInGroup: boolean,
  ): AnnotationKind {
    if (baseKind === 'arrow' && isFirstInGroup) return 'tab'
    return baseKind
  }

  try {
    if (multi) {
      // Handle multi-selection
      let sharedRefString: string | undefined = strReference
      let sharedRefIsExisting = false // Tracks if sharedRefString points to an existing annotation
      let isFirst = true // Track if this is the first node in multi-selection

      // Sort selection by position (top-to-bottom, left-to-right) for consistent ordering
      const sortedSelection = [...selection].sort((a, b) => {
        const yDiff = a.y - b.y
        if (Math.abs(yDiff) <= 20) {
          return a.x - b.x // Same row: left to right
        }
        return yDiff // Different rows: top to bottom
      })

      // If we're using same reference, calculate it once based on first element's position
      if (!sharedRefString && useSameReference) {
        const firstNode = sortedSelection[0]
        const { position: firstPos } = calculatePositionAndSize(
          true,
          padding,
          appendFrame,
          firstNode,
        )

        // For arrow mode: check if spatially previous annotation is in an arrow group
        if (annotationType === 'arrow') {
          const positionBasedRef =
            await manager.calculatePositionBasedReference(annotationType, {
              x: firstPos[0],
              y: firstPos[1],
            })
          // If spatially previous is an arrow-group member, use its reference
          // so all multi+same items add to that existing annotation
          sharedRefString =
            positionBasedRef.spatiallyPreviousRef ?? positionBasedRef.reference
          sharedRefIsExisting = !!positionBasedRef.spatiallyPreviousRef
          if (
            !positionBasedRef.spatiallyPreviousRef &&
            positionBasedRef.needsShift &&
            positionBasedRef.shiftFromPosition
          ) {
            await manager.shiftAnnotationsSpatially(
              positionBasedRef.shiftFromPosition,
              annotationType,
            )
          }
        } else {
          const positionBasedRef =
            await manager.calculatePositionBasedReference(annotationType, {
              x: firstPos[0],
              y: firstPos[1],
            })
          sharedRefString = positionBasedRef.reference
          if (
            positionBasedRef.needsShift &&
            positionBasedRef.shiftFromPosition
          ) {
            await manager.shiftAnnotationsSpatially(
              positionBasedRef.shiftFromPosition,
              annotationType,
            )
          }
        }
      }

      // Create one annotation for each selected element
      for (let i = 0; i < sortedSelection.length; i++) {
        const node = sortedSelection[i]
        isFirst = i === 0

        const { position, size } = calculatePositionAndSize(
          true,
          padding,
          appendFrame,
          node,
        )

        // Generate reference based on our strategy
        let refString: string
        let needsShift = false
        if (useSameReference) {
          // Use shared reference for all nodes
          refString = sharedRefString!
        } else if (strReference) {
          // Use provided reference if available
          refString = strReference
        } else {
          // Generate unique reference for each node based on position
          const positionBasedRef =
            await manager.calculatePositionBasedReference(annotationType, {
              x: position[0],
              y: position[1],
            })
          refString = positionBasedRef.reference
          needsShift = positionBasedRef.needsShift
        }

        try {
          // When using same reference for subsequent nodes, treat as "add to existing"
          const addToExistingForThisNode =
            (useSameReference && (!isFirst || sharedRefIsExisting)) ||
            addToExisting

          // For position-based: shift before first creation if needed using spatial-aware shifting
          if (needsShift && !useSameReference) {
            // Re-calculate to get the shiftFromPosition
            const posRef = await manager.calculatePositionBasedReference(
              annotationType,
              { x: position[0], y: position[1] },
            )
            if (posRef.needsShift && posRef.shiftFromPosition) {
              await manager.shiftAnnotationsSpatially(
                posRef.shiftFromPosition,
                annotationType,
              )
            }
          }

          // For arrow mode: first annotation in separate mode is tab, rest are arrow
          const effectiveKind = getEffectiveKind(
            annotationType,
            isFirst && !addToExistingForThisNode,
          )

          // Create the annotation using the state manager
          const result = await manager.addNewAnnotationWithShift(
            effectiveKind,
            refString,
            position,
            size,
            false, // Don't shift again, we handled it above
            'area', // Always use area type
            addToExistingForThisNode,
          )

          // Always add the record to our result array
          createdAnnotations.push(result.record)

          // First node processed, mark as false for subsequent iterations
          isFirst = false
        } catch (error) {
          // If using same reference and not the first item, warnings are ok
          if (
            useSameReference &&
            !isFirst &&
            error instanceof Error &&
            error.message.includes('already exists')
          ) {
            console.warn('Expected error for shared reference:', error.message)
            // Continue processing remaining nodes
          } else {
            throw error // Re-throw for normal operation
          }
        }
      }
    } else {
      // Create one annotation spanning all selected elements (single/entire)
      const { position, size } = calculatePositionAndSize(
        false,
        padding,
        appendFrame,
      )

      // For arrow mode (single/entire): check if spatially previous is in arrow group
      // If so, add to that existing annotation instead of creating new
      if (annotationType === 'arrow' && !strReference && !addToExisting) {
        const positionBasedRef = await manager.calculatePositionBasedReference(
          annotationType,
          {
            x: position[0],
            y: position[1],
          },
        )

        // If spatially previous annotation is an arrow-group member, add to it
        if (positionBasedRef.spatiallyPreviousRef) {
          const existingAnnotation = manager.findAnnotationByStrReference(
            positionBasedRef.spatiallyPreviousRef,
          )
          if (existingAnnotation) {
            const result = await manager.addNewAnnotationWithShift(
              existingAnnotation.kind,
              positionBasedRef.spatiallyPreviousRef,
              position,
              size,
              false,
              'area',
              true, // addToExisting
            )
            createdAnnotations.push(result.record)
          }
        } else {
          // No previous arrow-group member — create new tab with compound ref
          const refString = positionBasedRef.reference
          if (
            positionBasedRef.needsShift &&
            positionBasedRef.shiftFromPosition
          ) {
            await manager.shiftAnnotationsSpatially(
              positionBasedRef.shiftFromPosition,
              annotationType,
            )
          }
          const effectiveKind = getEffectiveKind(annotationType, true)
          const result = await manager.addNewAnnotationWithShift(
            effectiveKind,
            refString,
            position,
            size,
            false,
            'area',
            false,
          )
          createdAnnotations.push(result.record)
        }
      } else {
        // Non-arrow mode: original behavior
        let refString = strReference
        let shiftFromPosition: { x: number; y: number } | null = null
        if (!refString) {
          const positionBasedRef =
            await manager.calculatePositionBasedReference(annotationType, {
              x: position[0],
              y: position[1],
            })
          refString = positionBasedRef.reference
          shiftFromPosition = positionBasedRef.shiftFromPosition
        }

        // Shift existing annotations if needed using spatial-aware shifting
        if (shiftFromPosition) {
          await manager.shiftAnnotationsSpatially(
            shiftFromPosition,
            annotationType,
          )
        }

        // Create the annotation using the state manager
        const result = await manager.addNewAnnotationWithShift(
          annotationType,
          refString,
          position,
          size,
          false, // Don't shift again, we handled it above
          'area', // Always use area type
          addToExisting,
        )

        createdAnnotations.push(result.record)
      }
    }

    return createdAnnotations
  } catch (error) {
    console.error(
      'Failed to process annotations:',
      error,
      typeof error === 'object' && error !== null && 'stack' in error
        ? (error as { stack?: string }).stack
        : '',
    )
    throw error
  }
}

/**
 * Detect a component name from a single Figma node. Returns the technical name
 * if the node is an INSTANCE with a matching component key.
 */
async function detectComponentNameForNode(
  node: SceneNode,
): Promise<string | null> {
  if (node.type !== 'INSTANCE') return null

  const mainComponent = await (node as InstanceNode).getMainComponentAsync()
  if (!mainComponent) return null

  const parentKey =
    mainComponent.parent?.type === 'COMPONENT_SET'
      ? (mainComponent.parent as ComponentSetNode).key
      : null

  const entry = parentKey
    ? (findByFigmaKey(parentKey) ?? findByFigmaKey(mainComponent.key))
    : findByFigmaKey(mainComponent.key)

  return entry?.technicalName ?? null
}

/**
 * Detect a component name from the selected Figma nodes. Uses the first
 * INSTANCE node found and looks up its component key in the component map.
 */
async function detectComponentName(
  nodes: readonly SceneNode[],
): Promise<string | null> {
  const instance = nodes.find((n): n is InstanceNode => n.type === 'INSTANCE')
  if (!instance) return null
  return detectComponentNameForNode(instance)
}

