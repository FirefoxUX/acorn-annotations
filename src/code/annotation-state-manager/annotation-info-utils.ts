import type {
  AnnotationRecord,
  MergedInfoGroup,
  SingleReference,
} from '@src/types'
import type { AnnotationStateManager } from '.'
import NodeManager from './annotation-node-manager'
import { ReferenceUtils } from './annotation-reference-utils'
import { getAnnotationHash } from './merged-info-group-manager'

/**
 * Attempts to update the grouping of an annotation record within the state
 * manager.
 *
 * If the record is currently part of a merged info group (has an
 * annotationInfoNodeId) true), the function checks if the group's hash matches
 * the record's hash:
 *
 * - If `options.delete` is true, the record is removed from groups but not added
 *   to new ones.
 *
 * If the record is not part of a group or was removed, the function tries to
 * find an existing group or matching record to add the record to a group.
 *
 * @param stateManager - The annotation state manager responsible for managing
 *   annotation records and groups.
 * @param record - The annotation record to be checked and potentially
 *   regrouped.
 * @param options - Optional configuration settings.
 * @param options.delete - Whether the record is being deleted, in which case it
 *   should be removed from groups but not added to new ones. Default is false.
 * @returns The updated or newly created merged info group if grouping occurred,
 *   or `null` if no grouping was possible.
 */
async function updateAnnotationInfo(
  stateManager: AnnotationStateManager,
  record: AnnotationRecord,
  options: {
    delete?: boolean
    oldReference?: SingleReference
  } = {},
): Promise<void> {
  const isDelete = options.delete ?? false
  const oldReference = options.oldReference

  const manager = stateManager.infoGroupManager
  const changedGroups: Set<number> = new Set()
  const recordHash = getAnnotationHash(record)

  // check if there already is a group with this hash
  let existingGroup = manager.findByHash(recordHash)

  // if oldReference is set, we remove it from any groups it belongs to
  if (oldReference) {
    for (const group of manager) {
      if (group.references.has(oldReference)) {
        group.references.delete(oldReference)
        changedGroups.add(group.hash)
      }
    }
  } else {
    for (const group of manager) {
      if (group.references.has(record.strReference)) {
        // if this group only is size 1 we can update the hash
        // already to our record so we can re-use it
        if (group.references.size === 1) {
          if (!existingGroup) {
            group.hash = getAnnotationHash(record)
            existingGroup = group
          }
        }
        group.references.delete(record.strReference)
        changedGroups.add(group.hash)
      }
    }
  }

  if (!isDelete) {
    if (existingGroup) {
      existingGroup.references.add(record.strReference)
      changedGroups.add(existingGroup.hash)
    } else {
      const newGroup: MergedInfoGroup = {
        infoNodeId: null,
        hash: recordHash,
        references: new Set([record.strReference]),
      }
      manager.add(newGroup)
      changedGroups.add(newGroup.hash)
    }
  }

  // iterate over changedGroups
  // - changed groups where the references are 0 get deleted
  // - changed groups where the references are > 0 and have an info node set get updated
  // - changed groups where the references are > 0 and have no info node set create a new info node
  for (const groupHash of changedGroups) {
    const group = manager.findByHash(groupHash)
    if (group) {
      if (group.references.size === 0) {
        // Delete the group
        manager.removeByHash(group.hash)
        if (group.infoNodeId) await NodeManager.removeNode(group.infoNodeId!)
        continue
      }

      // find any record for this group
      const currentRecord =
        group.hash === recordHash
          ? record
          : stateManager.annotations.find(
              (a) => a.strReference === group.references.values().next().value,
            )
      if (!currentRecord) {
        console.warn(
          '[anInfoMgr.updateAnnotationInfo]\t No record found for group',
          group,
        )
        continue
      }

      if (group.infoNodeId) {
        // Update the existing info node
        await NodeManager.updateAnnotationInfo(
          group.infoNodeId,
          currentRecord,
          ReferenceUtils.formatComplexReference(group.references),
        )
        group.hash = getAnnotationHash(currentRecord)
      } else {
        // Create a new info node
        const newAnnotationInfoWrap = await NodeManager.createAnnotationInfo(
          stateManager,
          currentRecord,
          ReferenceUtils.formatComplexReference(group.references),
        )
        group.infoNodeId = newAnnotationInfoWrap.id
      }
    }
  }
}

/**
 * Completely rebuilds annotation info groups from scratch based on current
 * annotation records.
 *
 * The function:
 *
 * 1. Groups annotations with identical content (same hash value)
 * 2. Deletes all existing annotation info nodes in Figma
 * 3. Recreates info groups and nodes from scratch
 * 4. Updates all annotation records with their new info node IDs
 *
 * @param stateManager - The annotation state manager
 * @returns A promise that resolves when rebuild is complete
 */
async function rebuildAnnotationInfoGroups(
  stateManager: AnnotationStateManager,
): Promise<void> {
  const manager = stateManager.infoGroupManager

  // Step 1: Analyze and group all annotations by hash
  const hashGroups = new Map<number, AnnotationRecord[]>()
  const annotations = stateManager.annotations

  // Group annotations by hash value (same content = same group)
  for (const annotation of annotations) {
    // Skip annotations without node IDs (they don't have visible markers)
    if (annotation.annotationNodeId.length === 0) {
      continue
    }

    const hash = getAnnotationHash(annotation)
    if (!hashGroups.has(hash)) {
      hashGroups.set(hash, [])
    }
    hashGroups.get(hash)!.push(annotation)
  }

  // Step 2: Track and remove existing info nodes
  const existingInfoNodeIds = new Set<string>()
  for (const group of manager) {
    if (group.infoNodeId) {
      existingInfoNodeIds.add(group.infoNodeId)
    }
  }

  // Clear all merged info groups
  manager.clear()

  // Delete all existing info nodes from Figma
  for (const nodeId of existingInfoNodeIds) {
    try {
      await NodeManager.removeNode(nodeId)
    } catch (_error) {
      // Ignore errors during deletion
    }
  }

  // Step 3: Create new info nodes and groups for each hash group
  for (const [hash, groupAnnotations] of hashGroups.entries()) {
    if (groupAnnotations.length === 0) continue

    // Use the first annotation as the template
    const template = groupAnnotations[0]

    // Create complex reference string with all annotations in the group
    const references = new Set(groupAnnotations.map((a) => a.strReference))
    const complexReference = ReferenceUtils.formatComplexReference(references)

    try {
      // Create the new annotation info node
      const newInfoWrap = await NodeManager.createAnnotationInfo(
        stateManager,
        template,
        complexReference,
      )

      const infoNodeId = newInfoWrap.id

      // Create the new merged info group
      const newGroup: MergedInfoGroup = {
        infoNodeId,
        references,
        hash: hash,
      }

      // Add the group to state manager
      manager.add(newGroup)
    } catch (_error) {
      // Ignore errors during creation
    }
  }

  // Step 4: Final consistency check
  const missingInfoAnnotations = annotations.filter(
    (a) => manager.findMatchingRecord(a) === undefined,
  )

  if (missingInfoAnnotations.length > 0) {
    // Try to create individual info nodes for these
    for (const annotation of missingInfoAnnotations) {
      try {
        const newInfoWrap = await NodeManager.createAnnotationInfo(
          stateManager,
          annotation,
          annotation.strReference,
        )

        // Create a single-annotation group
        manager.add({
          infoNodeId: newInfoWrap.id,
          references: new Set([annotation.strReference]),
          hash: getAnnotationHash(annotation),
        })
      } catch (_error) {
        // Ignore errors during creation
      }
    }
  }
}

export default {
  getAnnotationHash,
  updateAnnotationInfo,
  rebuildAnnotationInfoGroups,
}
