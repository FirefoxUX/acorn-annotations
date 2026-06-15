import type { AnnotationStateManager } from '.'

/** Handles processing of Figma node changes for annotation nodes */
export async function handleDocumentChange(
  event: NodeChangeEvent,
  stateManager: AnnotationStateManager,
): Promise<void> {
  let relevantChanges = 0

  for (const change of event.nodeChanges) {
    if (change.node.type !== 'INSTANCE') continue

    switch (change.type) {
      case 'DELETE':
        relevantChanges++
        break

      case 'CREATE':
        relevantChanges++
        break

      case 'PROPERTY_CHANGE':
        if (change.properties.includes('componentProperties')) {
          relevantChanges++
        }
        break
    }
  }

  if (relevantChanges > 0) {
    // Defer regeneration if an operation is in progress to prevent race conditions
    if (stateManager.isOperationInProgress) {
      stateManager.requestRegenerate()
      return
    }
    await stateManager.regenerateState()
  }
}
