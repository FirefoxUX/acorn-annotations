import type { SavedFrameGroup, ValidatedFrameGroup } from '@src/types'
import sceneUtils from '../scene-utils'

const STORAGE_KEY = 'acorn-saved-frame-groups'

/** Generates a unique ID for a saved frame group */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/** Retrieves all saved frame groups from the current page's plugin data */
export function getSavedGroups(): SavedFrameGroup[] {
  const data = figma.currentPage.getPluginData(STORAGE_KEY)
  if (!data) return []
  try {
    return JSON.parse(data) as SavedFrameGroup[]
  } catch {
    console.warn('Failed to parse saved frame groups')
    return []
  }
}

/** Saves the array of frame groups to the current page's plugin data */
function persistGroups(groups: SavedFrameGroup[]): void {
  figma.currentPage.setPluginData(STORAGE_KEY, JSON.stringify(groups))
}

/**
 * Saves a new frame group or updates an existing one with the same annotation
 * frame ID
 */
export function saveGroup(
  name: string,
  mode: 'desktop' | 'mobile',
  annotationFrameId: string,
  annotationInfoFrameId: string | { navigation: string; notes: string },
): SavedFrameGroup {
  const groups = getSavedGroups()

  // Check if a group with this annotation frame already exists
  const existingIndex = groups.findIndex(
    (g) => g.annotationFrameId === annotationFrameId,
  )

  const group: SavedFrameGroup = {
    id: existingIndex >= 0 ? groups[existingIndex].id : generateId(),
    name,
    mode,
    annotationFrameId,
    annotationInfoFrameId,
    createdAt:
      existingIndex >= 0 ? groups[existingIndex].createdAt : Date.now(),
  }

  if (existingIndex >= 0) {
    groups[existingIndex] = group
  } else {
    groups.push(group)
  }

  persistGroups(groups)
  return group
}

/** Deletes a saved frame group by its ID */
export function deleteGroup(groupId: string): boolean {
  const groups = getSavedGroups()
  const index = groups.findIndex((g) => g.id === groupId)
  if (index < 0) return false

  groups.splice(index, 1)
  persistGroups(groups)
  return true
}

/** Renames a saved frame group */
export function renameGroup(groupId: string, newName: string): boolean {
  const groups = getSavedGroups()
  const group = groups.find((g) => g.id === groupId)
  if (!group) return false

  group.name = newName
  persistGroups(groups)
  return true
}

/**
 * Checks if a node is a FRAME on the current page. Returns the invalidReason if
 * not.
 */
function validateFrameNode(
  node: BaseNode | null,
  currentPageId: string,
):
  | { valid: true }
  | { valid: false; reason: ValidatedFrameGroup['invalidReason'] } {
  if (!node) return { valid: false, reason: 'deleted' }
  if (node.type !== 'FRAME') return { valid: false, reason: 'wrong-type' }
  const page = sceneUtils.findPageNode(node as SceneNode)
  if (!page || page.id !== currentPageId)
    return { valid: false, reason: 'wrong-page' }
  return { valid: true }
}

/**
 * Validates all saved groups by checking if their referenced frames still
 * exist, are the correct type, and are on the current page. Returns enriched
 * data with frame names, validity status, and failure reasons.
 */
export async function validateGroups(
  groups: SavedFrameGroup[],
): Promise<ValidatedFrameGroup[]> {
  const currentPageId = figma.currentPage.id

  return Promise.all(
    groups.map(async (group) => {
      let invalidReason: ValidatedFrameGroup['invalidReason']

      // Validate annotation frame
      const annotationFrame = await figma.getNodeByIdAsync(
        group.annotationFrameId,
      )
      const annotationCheck = validateFrameNode(annotationFrame, currentPageId)
      const annotationFrameValid = annotationCheck.valid
      if (!annotationCheck.valid) {
        invalidReason = annotationCheck.reason
      }

      // Validate info frame(s)
      let infoFrameValid: boolean
      const infoFrameNames: ValidatedFrameGroup['infoFrameNames'] = {}

      if (typeof group.annotationInfoFrameId === 'string') {
        const infoFrame = await figma.getNodeByIdAsync(
          group.annotationInfoFrameId,
        )
        const infoCheck = validateFrameNode(infoFrame, currentPageId)
        infoFrameValid = infoCheck.valid
        if (!infoCheck.valid) {
          invalidReason = invalidReason || infoCheck.reason
        }
        if (infoFrame) {
          infoFrameNames.single = infoFrame.name
        }
      } else {
        const navFrame = await figma.getNodeByIdAsync(
          group.annotationInfoFrameId.navigation,
        )
        const notesFrame = await figma.getNodeByIdAsync(
          group.annotationInfoFrameId.notes,
        )

        const navCheck = validateFrameNode(navFrame, currentPageId)
        const notesCheck = validateFrameNode(notesFrame, currentPageId)

        infoFrameValid = navCheck.valid && notesCheck.valid
        if (!navCheck.valid) {
          invalidReason = invalidReason || navCheck.reason
        }
        if (!notesCheck.valid) {
          invalidReason = invalidReason || notesCheck.reason
        }
        if (navFrame) {
          infoFrameNames.navigation = navFrame.name
        }
        if (notesFrame) {
          infoFrameNames.notes = notesFrame.name
        }
      }

      const isValid = annotationFrameValid && infoFrameValid

      return {
        ...group,
        isValid,
        invalidReason: isValid ? undefined : invalidReason,
        annotationFrameName: annotationFrame?.name,
        infoFrameNames,
      }
    }),
  )
}

/** Loads saved groups and validates them in one call */
export async function loadAndValidateGroups(): Promise<ValidatedFrameGroup[]> {
  const groups = getSavedGroups()
  return validateGroups(groups)
}
