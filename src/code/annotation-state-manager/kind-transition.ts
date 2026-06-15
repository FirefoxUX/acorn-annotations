import type {
  AnnotationKind,
  AnnotationRecord,
  BaseAnnotationRecord,
  TabArrowNoteFields,
  ComponentNoteFields,
} from '@src/types'
import { ReferenceUtils } from './annotation-reference-utils'

/** Context needed for computing new references during kind transitions */
export interface KindTransitionContext {
  annotations: readonly AnnotationRecord[]
}

/** Result of a kind transition, including boundary crossing info */
export interface KindTransitionResult {
  record: AnnotationRecord
  crossedBoundary: boolean
  oldReference: string
}

/**
 * Checks if a kind transition crosses the navigation/note boundary. Navigation
 * kinds: tab, arrow Note kinds: note, component-note, presentational
 */
function crossesBoundary(
  oldKind: AnnotationKind,
  newKind: AnnotationKind,
): boolean {
  return (
    ReferenceUtils.isNavigationKind(oldKind) !==
    ReferenceUtils.isNavigationKind(newKind)
  )
}

/**
 * Computes the next available reference number for a target kind. Scans all
 * annotations of the same navigation category and finds max + 1.
 */
function getNextReferenceNumber(
  annotations: readonly AnnotationRecord[],
  targetKind: AnnotationKind,
): number {
  const isNavigation = ReferenceUtils.isNavigationKind(targetKind)
  let maxRef = 0

  for (const a of annotations) {
    if (ReferenceUtils.isNavigationKind(a.kind) !== isNavigation) continue
    const parsed = ReferenceUtils.tryParseReference(a.strReference)
    if (parsed && parsed.referenceNumber > maxRef) {
      maxRef = parsed.referenceNumber
    }
  }

  return maxRef + 1
}

/** Fields that can potentially be preserved when transitioning between kinds */
interface PreservedFields {
  name?: string
  role?: string
  note?: string
  componentName?: string
  showComponentName?: boolean
}

/** Extracts preservable fields from an annotation record based on its kind */
function extractPreservableFields(record: AnnotationRecord): PreservedFields {
  const fields: PreservedFields = {}

  switch (record.kind) {
    case 'tab':
    case 'arrow':
    case 'note': {
      const typedRecord = record as BaseAnnotationRecord & {
        kind: 'tab' | 'arrow' | 'note'
      } & TabArrowNoteFields

      fields.name = typedRecord.name
      fields.role = typedRecord.role
      fields.note = typedRecord.note
      fields.componentName = typedRecord.componentName
      fields.showComponentName = typedRecord.showComponentName
      break
    }
    case 'component-note': {
      const typedRecord = record as BaseAnnotationRecord & {
        kind: 'component-note'
      } & ComponentNoteFields

      fields.name = typedRecord.name
      fields.note = typedRecord.note
      fields.componentName = typedRecord.componentName
      // component-note always has showComponentName=true
      fields.showComponentName = true
      break
    }
    // No fields to preserve from presentational
  }

  return fields
}

/** Builds a new annotation record for a specific kind with preserved fields */
function buildRecordForKind(
  newKind: AnnotationKind,
  strReference: string,
  annotationNodeId: string[],
  preserved: PreservedFields,
): AnnotationRecord {
  switch (newKind) {
    case 'tab':
    case 'arrow':
    case 'note': {
      const record = {
        kind: newKind,
        strReference,
        annotationNodeId,
        name: preserved.name ?? '',
        role: preserved.role ?? '',
        note: preserved.note ?? '',
        componentName: preserved.componentName ?? '',
        showComponentName: preserved.showComponentName ?? false,
      } as BaseAnnotationRecord & {
        kind: typeof newKind
      } & TabArrowNoteFields

      // For tab and arrow, respect user choice for showComponentName
      // (tabs can be part of arrow groups with compound refs)
      // For note, enforce showComponentName = false
      if (newKind === 'note') {
        record.showComponentName = false
      }

      return record
    }
    case 'component-note': {
      const record = {
        kind: newKind,
        strReference,
        annotationNodeId,
        name: preserved.name ?? '',
        note: preserved.note ?? '',
        componentName: preserved.componentName ?? '',
      } as BaseAnnotationRecord & {
        kind: typeof newKind
      } & ComponentNoteFields

      return record
    }
    case 'presentational': {
      const record = {
        kind: newKind,
        strReference,
        annotationNodeId,
      } as BaseAnnotationRecord & { kind: 'presentational' }

      return record
    }
    default: {
      // This should never happen because newKind is typed, but TypeScript needs it
      throw new Error(`Invalid annotation kind: ${newKind}`)
    }
  }
}

/**
 * Transitions an annotation record from one kind to another, preserving
 * compatible fields and setting appropriate defaults.
 *
 * - Removes fields that are not applicable to the new kind
 * - Adds default values for fields required by the new kind but not present
 * - Preserves compatible fields when changing between types
 * - Converts reference format when crossing navigation/note boundary
 *
 * @param oldRecord - The existing annotation record to transition
 * @param newKind - The target annotation kind
 * @param context - Optional context with current annotations for computing new
 *   references
 * @returns Transition result with the new record and boundary crossing info
 */
export function transitionAnnotationKind(
  oldRecord: AnnotationRecord,
  newKind: AnnotationKind,
  context?: KindTransitionContext,
): KindTransitionResult {
  const oldReference = oldRecord.strReference

  // If kind is the same, return the original record unchanged
  if (oldRecord.kind === newKind) {
    return { record: oldRecord, crossedBoundary: false, oldReference }
  }

  const crossed = crossesBoundary(oldRecord.kind, newKind)
  const preserved = extractPreservableFields(oldRecord)

  // Compute new reference based on transition type
  let newReference = oldReference

  if (crossed && context) {
    // Crossing navigation/note boundary: compute new reference in target format
    const nextNum = getNextReferenceNumber(context.annotations, newKind)
    newReference = ReferenceUtils.encodeReference(newKind, nextNum, null)
  } else if (oldRecord.kind === 'arrow' && newKind === 'tab') {
    // Arrow to tab: keep compound ref if present (e.g., "3B" becomes tab "3B").
    const parsed = ReferenceUtils.tryParseReference(oldReference)
    if (parsed) {
      newReference = ReferenceUtils.encodeReference(
        'tab',
        parsed.referenceNumber,
        parsed.subReference,
      )
    }
  } else if (oldRecord.kind === 'tab' && newKind === 'arrow') {
    // Tab to arrow: keep compound ref if present, add sub-ref 'A' if simple.
    const parsed = ReferenceUtils.tryParseReference(oldReference)
    if (parsed) {
      newReference = ReferenceUtils.encodeReference(
        'arrow',
        parsed.referenceNumber,
        parsed.subReference ?? 1, // Keep existing sub-ref, or add 'A'
      )
    }
  }

  // Build the new record with the computed reference
  const record = buildRecordForKind(
    newKind,
    newReference,
    oldRecord.annotationNodeId,
    preserved,
  )

  return { record, crossedBoundary: crossed, oldReference }
}
