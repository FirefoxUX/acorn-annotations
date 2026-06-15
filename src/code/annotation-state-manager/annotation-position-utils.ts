import type { AnnotationKind, AnnotationRecord } from '@src/types'
import { ReferenceUtils } from './annotation-reference-utils'

/**
 * Y-tolerance in pixels for considering annotations on the same row.
 * Annotations within this vertical distance are sorted left-to-right.
 */
const Y_TOLERANCE = 20

/**
 * Finds an unused reference number between prevRef and nextRef (exclusive).
 * Returns null if no gap exists.
 */
export function findReferenceGap(
  existingRefs: Set<number>,
  prevRef: number, // Reference of spatially-previous annotation (0 if none)
  nextRef: number, // Reference of spatially-next annotation (max+1 if none)
): number | null {
  for (let candidate = prevRef + 1; candidate < nextRef; candidate++) {
    if (!existingRefs.has(candidate)) {
      return candidate
    }
  }
  return null
}

/** Gets all existing reference numbers for a group. */
export function collectExistingRefs(
  annotations: AnnotationRecord[],
  group: 'navigation' | 'notes',
): Set<number> {
  const refs = new Set<number>()
  const isNavGroup = group === 'navigation'
  for (const a of annotations) {
    if (ReferenceUtils.isNavigationKind(a.kind) !== isNavGroup) continue
    const parsed = ReferenceUtils.tryParseReference(a.strReference)
    if (parsed) refs.add(parsed.referenceNumber)
  }
  return refs
}

/** Position data for an annotation, used for spatial sorting */
export type AnnotationPosition = {
  strReference: string
  kind: AnnotationKind
  x: number
  y: number
}

/**
 * Gets the position of an annotation's first marker node. Returns null if no
 * markers exist or node can't be found.
 */
export async function getAnnotationPosition(
  annotationNodeIds: string[],
): Promise<{ x: number; y: number } | null> {
  if (annotationNodeIds.length === 0) return null

  const node = await figma.getNodeByIdAsync(annotationNodeIds[0])
  if (!node || !('x' in node)) return null

  return { x: (node as SceneNode).x, y: (node as SceneNode).y }
}

/**
 * Collects positions for all annotations in a specific group (navigation or
 * notes). Only includes annotations that have at least one marker node.
 */
export async function collectAnnotationPositions(
  annotations: AnnotationRecord[],
  group: 'navigation' | 'notes',
): Promise<AnnotationPosition[]> {
  const isNavGroup = group === 'navigation'
  const filtered = annotations.filter(
    (a) => ReferenceUtils.isNavigationKind(a.kind) === isNavGroup,
  )

  const positions: AnnotationPosition[] = []
  for (const a of filtered) {
    const pos = await getAnnotationPosition(a.annotationNodeId)
    if (pos) {
      positions.push({
        strReference: a.strReference,
        kind: a.kind,
        x: pos.x,
        y: pos.y,
      })
    }
  }

  return positions
}

/**
 * Compares two positions for sorting: top-to-bottom, left-to-right. Annotations
 * within Y_TOLERANCE pixels vertically are considered the same row.
 *
 * @returns Negative if a comes before b, positive if after, 0 if equal
 */
export function comparePositions(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const yDiff = a.y - b.y

  if (Math.abs(yDiff) <= Y_TOLERANCE) {
    // Same row: sort left to right
    return a.x - b.x
  }

  // Different rows: sort top to bottom
  return yDiff
}
