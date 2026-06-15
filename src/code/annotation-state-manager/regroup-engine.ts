import type {
  AnnotationKind,
  AnnotationRecord,
  SingleReference,
} from '@src/types'
import { ReferenceUtils } from './annotation-reference-utils'

/**
 * Input type for regroup operation. Either a plain annotation record, or an
 * object specifying a record with optional kind/reference changes.
 */
export type RegroupInput =
  | AnnotationRecord
  | {
      record: AnnotationRecord
      newKind: AnnotationKind
      placeholderReference?: SingleReference
    }

/**
 * Output type for regroup operation. Specifies the new reference (and
 * optionally new kind) for each annotation.
 */
export type RegroupOutput = {
  annotation: AnnotationRecord
  newReference: SingleReference
  newKind?: AnnotationKind
}

/** Extracts the effective values from a regroup input item. */
function extractEffectiveValues(item: RegroupInput): {
  annotation: AnnotationRecord
  newKind: AnnotationKind | undefined
  effectiveKind: AnnotationKind
  effectiveStrReference: SingleReference
} {
  const annotation = 'record' in item ? item.record : item
  const newKind = 'newKind' in item ? item.newKind : undefined
  const effectiveKind = newKind || annotation.kind
  const effectiveStrReference =
    'placeholderReference' in item && item.placeholderReference
      ? item.placeholderReference
      : annotation.strReference

  return { annotation, newKind, effectiveKind, effectiveStrReference }
}

/**
 * Computes new references for a set of annotation groups.
 *
 * This is a pure function that takes sorted annotation groups and produces a
 * list of reference reassignments. The counter logic handles:
 *
 * - Tab/note annotations: sequential numbering (1, 2, 3...)
 * - Arrow annotations: grouped by parent reference with sub-references (1A, 1B,
 *   2A...)
 *
 * @param groups - Array of annotation groups, each pre-sorted by desired order
 * @returns Array of edit instructions with new references
 */
export function computeRegroupedReferences(
  groups: RegroupInput[][],
): RegroupOutput[] {
  const results: RegroupOutput[] = []

  for (const group of groups) {
    let counter = 0
    let currentArrow: number | null = null
    let arrowCounter: number | null = null

    for (const item of group) {
      const { annotation, newKind, effectiveKind, effectiveStrReference } =
        extractEffectiveValues(item)

      const parsed = ReferenceUtils.tryParseReference(effectiveStrReference)
      if (!parsed) {
        continue
      }

      // Update counters based on whether the annotation is in an arrow group.
      // Arrow group membership is determined by compound reference (subReference != null),
      // regardless of whether kind is 'tab' or 'arrow' (tabs can be arrow group members).
      const isInArrowGroup = parsed.subReference !== null
      if (!isInArrowGroup) {
        // Not in arrow group: reset arrow tracking, increment main counter
        if (currentArrow !== null) {
          currentArrow = null
          arrowCounter = null
        }
        counter++
      } else {
        // In arrow group: track groups with sub-references
        if (currentArrow !== parsed.referenceNumber) {
          // New arrow group
          currentArrow = parsed.referenceNumber
          counter++
          arrowCounter = 1
        } else if (arrowCounter !== null) {
          // Same arrow group, increment sub-reference
          arrowCounter++
        } else {
          throw new Error('Unexpected arrow annotation state')
        }
      }

      const newReference = ReferenceUtils.encodeReference(
        effectiveKind,
        counter,
        arrowCounter,
      )

      results.push({ annotation, newReference, newKind })
    }
  }

  return results
}
