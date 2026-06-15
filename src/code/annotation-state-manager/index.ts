import {
  AnnotationInfoWrap,
  AnnotationWrap,
  type AnnotationInfoProperties,
} from '@code/annotation-components'
import type {
  AnnotationKind,
  AnnotationRecord,
  BaseAnnotationRecord,
  FigmaAnnotationKind,
  FigmaAnnotationType,
  LockState,
  MergedInfoGroup,
  MergedInfoGroupSerialized,
  SingleReference,
} from '@src/types'
import { createObservableState } from '../utils'
import { ReferenceUtils } from './annotation-reference-utils'
import { KindMapper } from './annotation-kind-mapper'
import NodeManager from './annotation-node-manager'
import { handleDocumentChange } from './annotation-change-handler'
import InfoUtils from './annotation-info-utils'
import { computeRegroupedReferences, type RegroupInput } from './regroup-engine'
import { orderAnnotationMarkers, orderInfoNodes } from './figma-ordering'
import {
  transitionAnnotationKind,
  type KindTransitionResult,
} from './kind-transition'
import {
  MergedInfoGroupManager,
  getAnnotationHash,
} from './merged-info-group-manager'
import {
  collectAnnotationPositions,
  collectExistingRefs,
  comparePositions,
  findReferenceGap,
  type AnnotationPosition,
} from './annotation-position-utils'

export type AnnotationGroup = 'navigation' | 'notes'

/**
 * Checks if an annotation (or position) is part of an arrow group based on
 * compound reference
 */
function isArrowGroupMember(
  refOrRecord: { strReference: string } | string,
): boolean {
  const ref =
    typeof refOrRecord === 'string' ? refOrRecord : refOrRecord.strReference
  const parsed = ReferenceUtils.tryParseReference(ref)
  return parsed?.subReference !== null
}

/**
 * Manages annotation state and coordinates between Figma nodes and internal
 * data structures
 */
export class AnnotationStateManager {
  private state: {
    annotations: AnnotationRecord[]
    mergedInfoGroups: MergedInfoGroup[]
  }
  private onStateChange?: (annotations: AnnotationRecord[]) => void
  private lockState: LockState = 'all-unlocked'
  private eventHandlerFn?: (event: NodeChangeEvent) => void
  private boundPage: PageNode | null = null

  // Operation locking to prevent race conditions with change handler
  // Uses counter for re-entrant lock support (nested operations)
  private operationDepth = 0
  private pendingRegenerate = false

  // Manager for merged info groups - provides clean API for group operations
  readonly infoGroupManager: MergedInfoGroupManager

  get annotations(): AnnotationRecord[] {
    return this.state.annotations
  }

  get mergedInfoGroups(): MergedInfoGroup[] {
    return this.state.mergedInfoGroups
  }

  // Getter for lock state
  get currentLockState(): LockState {
    return this.lockState
  }

  // Getters for operation lock state (used by change handler)
  get isOperationInProgress(): boolean {
    return this.operationDepth > 0
  }

  requestRegenerate(): void {
    this.pendingRegenerate = true
  }

  // Wraps async operations to prevent change handler from triggering regenerateState during active operations
  // Re-entrant: nested calls increment/decrement the counter, only outermost releases the lock
  private async withOperationLock<T>(operation: () => Promise<T>): Promise<T> {
    this.operationDepth++
    try {
      return await operation()
    } finally {
      this.operationDepth--
      // Only run pending regenerate when all operations complete (outermost lock released)
      if (this.operationDepth === 0 && this.pendingRegenerate) {
        this.pendingRegenerate = false
        await this.regenerateState()
      }
    }
  }

  private onMergedInfoGroupsChange?: (
    groups: MergedInfoGroupSerialized[],
  ) => void

  constructor(
    readonly annotationFrameId: string,
    readonly annotationInfoFrameId:
      | string
      | { navigation: string; notes: string },
    onStateChange?: (annotations: AnnotationRecord[]) => void,
    onMergedInfoGroupsChange?: (groups: MergedInfoGroupSerialized[]) => void,
  ) {
    this.onStateChange = onStateChange
    this.onMergedInfoGroupsChange = onMergedInfoGroupsChange

    // Initialize observable state
    this.state = createObservableState(
      {
        annotations: [] as AnnotationRecord[],
        mergedInfoGroups: [] as MergedInfoGroup[],
      },
      (state) => {
        if (this.onStateChange) {
          this.onStateChange(state.annotations)
        }
        if (this.onMergedInfoGroupsChange) {
          // for each entry change the set to an array
          const serializedGroups = state.mergedInfoGroups.map((group) => ({
            ...group,
            references: Array.from(group.references),
          }))

          this.onMergedInfoGroupsChange(serializedGroups)
        }
      },
    )

    // Initialize the info group manager with accessors to state
    this.infoGroupManager = new MergedInfoGroupManager(
      () => this.state.mergedInfoGroups,
      (groups) => {
        this.state.mergedInfoGroups = groups
      },
    )
  }

  /** Initializes the manager by regenerating state and setting up event handlers */
  async initialize(page: PageNode): Promise<void> {
    await this.regenerateState()
    await this.migrateOldArrowGroups() // Convert old standalone tab + arrows to new model
    await this.regroupAnnotations() // Normalize gaps in references and update marker types
    await InfoUtils.rebuildAnnotationInfoGroups(this)
    await this.ensureFigmaOrder()

    const detectedState = await NodeManager.detectLockState(this)
    await NodeManager.applyLockState(this, detectedState)
    this.lockState = detectedState

    this.boundPage = page
    this.eventHandlerFn = (event) => handleDocumentChange(event, this)
    page.on('nodechange', this.eventHandlerFn)
  }

  uninitialize(): void {
    if (this.eventHandlerFn && this.boundPage) {
      this.boundPage.off('nodechange', this.eventHandlerFn)
      this.eventHandlerFn = undefined
      this.boundPage = null
    }
  }

  /**
   * Migrates old-style arrow groups (standalone tab "N" + arrows "NA", "NB") to
   * the new model (tab "NA" with compound ref + arrows "NB", "NC"). Runs after
   * regenerateState to handle legacy annotations.
   */
  private async migrateOldArrowGroups(): Promise<void> {
    // Find standalone tabs with simple references (no sub-reference)
    const standaloneTabs = this.state.annotations.filter((a) => {
      if (a.kind !== 'tab') return false
      const parsed = ReferenceUtils.tryParseReference(a.strReference)
      return parsed && parsed.subReference === null
    })

    for (const tab of standaloneTabs) {
      const parsed = ReferenceUtils.tryParseReference(tab.strReference)
      if (!parsed) continue

      // Check if there are compound-ref annotations with the same reference number
      const groupMembers = this.state.annotations.filter((a) => {
        if (a === tab) return false
        const aParsed = ReferenceUtils.tryParseReference(a.strReference)
        return (
          aParsed &&
          aParsed.referenceNumber === parsed.referenceNumber &&
          aParsed.subReference !== null
        )
      })

      if (groupMembers.length === 0) continue // Not an old-style group

      // Find the first member (subReference = 1, e.g., "NA")
      const firstMember = groupMembers.find((m) => {
        const mParsed = ReferenceUtils.tryParseReference(m.strReference)
        return mParsed && mParsed.subReference === 1
      })

      if (firstMember) {
        // Merge standalone tab markers into the first member
        firstMember.annotationNodeId = [
          ...tab.annotationNodeId,
          ...firstMember.annotationNodeId,
        ]
        // Ensure first member is kind='tab' (it should already be after KindMapper change)
        firstMember.kind = 'tab'
        await this.ensureMarkerConsistency(firstMember)
      } else {
        // No first member found — remove markers from standalone tab
        for (const nodeId of tab.annotationNodeId) {
          await NodeManager.removeNode(nodeId)
        }
      }

      // Remove the standalone tab from state
      const idx = this.state.annotations.indexOf(tab)
      if (idx !== -1) {
        this.state.annotations.splice(idx, 1)
      }
    }
  }

  async setLockState(state: LockState): Promise<void> {
    this.lockState = state
    await NodeManager.applyLockState(this, state)
  }

  /**
   * Removes a merged info group by its hash
   *
   * @deprecated Use infoGroupManager.removeByHash() instead
   */
  removeMergedInfoGroup(hash: number): boolean {
    return this.infoGroupManager.removeByHash(hash)
  }

  /** Returns annotation record for a given string reference */
  findAnnotationByStrReference(
    reference: SingleReference,
  ): AnnotationRecord | undefined {
    // First try exact match
    const exactMatch = this.state.annotations.find(
      (annotation) => annotation.strReference === reference,
    )
    if (exactMatch) return exactMatch

    // Try with normalized reference
    const cleanRef = ReferenceUtils.normalizeReference(reference)
    return this.state.annotations.find(
      (annotation) =>
        ReferenceUtils.normalizeReference(annotation.strReference) === cleanRef,
    )
  }

  /**
   * Finds a group that matches an annotation record's content hash
   *
   * @deprecated Use infoGroupManager.findMatchingRecord() instead
   */
  findMatchingMergedInfoGroup(
    record: AnnotationRecord,
  ): MergedInfoGroup | undefined {
    return this.infoGroupManager.findMatchingRecord(record)
  }

  /**
   * Finds a group by its info node ID
   *
   * @deprecated Use infoGroupManager.findByInfoNodeId() instead
   */
  findMergedInfoGroupBySharedInfoId(
    infoNodeId: string,
  ): MergedInfoGroup | undefined {
    return this.infoGroupManager.findByInfoNodeId(infoNodeId)
  }

  /** Gets all annotation wrappers from the annotation frame */
  private async getAnnotations(): Promise<readonly AnnotationWrap[]> {
    const node = await figma.getNodeByIdAsync(this.annotationFrameId)
    const instances =
      node && 'children' in node
        ? (node.children.filter((child) =>
            AnnotationWrap.isOfType(child),
          ) as InstanceNode[])
        : []

    return instances.map((instance) => new AnnotationWrap(instance))
  }

  /** Gets all annotation info wrappers from info frames */
  private async getAnnotationInfos(): Promise<AnnotationInfoWrap[]> {
    const frameIds =
      typeof this.annotationInfoFrameId === 'string'
        ? [this.annotationInfoFrameId]
        : [
            this.annotationInfoFrameId.navigation,
            this.annotationInfoFrameId.notes,
          ]

    const frames = await Promise.all(
      frameIds.map((id) => figma.getNodeByIdAsync(id)),
    )

    const allInstances = frames.flatMap((frame) =>
      frame && 'children' in frame
        ? frame.children.filter((child) => AnnotationInfoWrap.isOfType(child))
        : [],
    ) as InstanceNode[]

    return allInstances.map((instance) => new AnnotationInfoWrap(instance))
  }

  /** Creates a new annotation with both marker and info components */
  async addNewAnnotation(
    kind: AnnotationKind,
    reference: SingleReference,
    position: [number, number],
    size: [number, number],
    type?: FigmaAnnotationType,
  ): Promise<AnnotationRecord> {
    return this.withOperationLock(async () => {
      // Check if annotation already exists
      const existingEntry = this.findAnnotationByStrReference(reference)
      if (existingEntry) {
        throw new Error('Annotation with this reference already exists!')
      }

      // Create annotation record
      const baseRecord: BaseAnnotationRecord = {
        strReference: reference,
        annotationNodeId: [],
        kind: kind,
      }

      const record = this.createAnnotationRecord(baseRecord, null)

      this.insertSortedAnnotation(record)

      try {
        const newAnnotationWrap = await NodeManager.createAnnotationMarker(
          this,
          position,
          size,
          record,
          reference,
          type,
          this.lockState === 'annotations-locked',
        )
        record.annotationNodeId.push(newAnnotationWrap.id)
      } catch (_e) {
        console.warn('Failed to create annotation')
      }

      await InfoUtils.updateAnnotationInfo(this, record)

      return record
    })
  }

  /**
   * Creates a new annotation with options for handling existing annotations:
   *
   * - If shiftIfExists is true: shifts existing annotations (displace mode)
   * - If shiftIfExists is false and addToExisting is true: adds to existing
   *   annotation (add mode)
   * - Otherwise: throws an error if annotation already exists
   *
   * @returns The annotation record and whether an existing annotation was found
   */
  async addNewAnnotationWithShift(
    kind: AnnotationKind,
    reference: SingleReference,
    position: [number, number],
    size: [number, number],
    shiftIfExists: boolean = false,
    type?: FigmaAnnotationType,
    addToExisting: boolean = false,
  ): Promise<{ record: AnnotationRecord; existingFound: boolean }> {
    return this.withOperationLock(async () => {
      const existingEntry = this.findAnnotationByStrReference(reference)
      if (existingEntry) {
        if (shiftIfExists) {
          // Displace mode - shift existing annotations
          await this.shiftAnnotations(reference, kind)
        } else if (addToExisting) {
          // Add mode - create a new marker and add it to the existing annotation
          try {
            // For tab annotations with compound ref, additional markers display as arrow (green)
            const isCompound = isArrowGroupMember(existingEntry)
            const displayKind =
              existingEntry.kind === 'tab' && isCompound
                ? ('arrow' as AnnotationKind)
                : undefined
            const newAnnotationWrap = await NodeManager.createAnnotationMarker(
              this,
              position,
              size,
              existingEntry,
              reference,
              type,
              this.lockState === 'annotations-locked',
              displayKind,
            )
            existingEntry.annotationNodeId.push(newAnnotationWrap.id)
            return { record: existingEntry, existingFound: true }
          } catch (e) {
            console.warn('Failed to add to existing annotation:', e)
            throw new Error('Failed to add to existing annotation', { cause: e })
          }
        } else {
          throw new Error('Annotation with this reference already exists!')
        }
      }

      const record = await this.addNewAnnotation(
        kind,
        reference,
        position,
        size,
        type,
      )
      return { record, existingFound: false }
    })
  }

  /**
   * Calculates the reference for a new annotation based on its position. Uses
   * spatial sorting (top-to-bottom, left-to-right) to determine where the
   * annotation fits among existing ones.
   *
   * Uses a 3-tier strategy to handle manually reordered annotations:
   *
   * 1. Try to find a gap in references between spatial neighbors
   * 2. If no gap, check if we can safely shift spatially-after annotations
   * 3. Fall back to max+1 (always safe)
   *
   * @param kind - The kind of annotation being created
   * @param position - The x,y coordinates of the new annotation
   * @returns The reference string, whether shift is needed, and the spatial
   *   position to shift from (if needed)
   */
  async calculatePositionBasedReference(
    kind: AnnotationKind,
    position: { x: number; y: number },
  ): Promise<{
    reference: string
    needsShift: boolean
    shiftFromPosition: { x: number; y: number } | null
    /**
     * The reference of the spatially previous annotation if it's an arrow-group
     * member. When non-null, callers should add to this existing annotation
     * instead of creating new.
     */
    spatiallyPreviousRef: string | null
  }> {
    const isNavigation = ReferenceUtils.isNavigationKind(kind)
    const group: AnnotationGroup = isNavigation ? 'navigation' : 'notes'

    // Collect existing refs and positions
    const existingRefs = collectExistingRefs(this.state.annotations, group)
    const positions = await collectAnnotationPositions(
      this.state.annotations,
      group,
    )
    positions.sort(comparePositions)

    // Find max reference for fallback
    const maxRef = Math.max(0, ...existingRefs)

    // Find spatial neighbors
    let spatiallyPrev: AnnotationPosition | null = null
    let spatiallyNext: AnnotationPosition | null = null

    for (let i = 0; i < positions.length; i++) {
      if (comparePositions(position, positions[i]) < 0) {
        spatiallyNext = positions[i]
        spatiallyPrev = i > 0 ? positions[i - 1] : null
        break
      }
      spatiallyPrev = positions[i]
    }

    const prevRef = spatiallyPrev
      ? (ReferenceUtils.tryParseReference(spatiallyPrev.strReference)
          ?.referenceNumber ?? 0)
      : 0
    const nextRef = spatiallyNext
      ? (ReferenceUtils.tryParseReference(spatiallyNext.strReference)
          ?.referenceNumber ?? maxRef + 1)
      : maxRef + 1

    // Handle arrows: find sub-reference within the arrow group
    // Arrow group membership is detected by compound reference, not just kind='arrow'
    if (kind === 'arrow') {
      // If spatially previous is an arrow-group member, return its reference directly
      // so the caller can add to that existing annotation
      if (spatiallyPrev && isArrowGroupMember(spatiallyPrev)) {
        const prevParsed = ReferenceUtils.tryParseReference(
          spatiallyPrev.strReference,
        )
        const targetRefNum = prevParsed?.referenceNumber ?? 1

        // Find all arrow-group members at this reference number
        const arrowsAtRef = positions.filter((p) => {
          const parsed = ReferenceUtils.tryParseReference(p.strReference)
          if (!parsed || parsed.subReference === null) return false
          return parsed.referenceNumber === targetRefNum
        })

        // Auto-incremented sub-reference (for multi+separate mode)
        let subReference = 1
        for (const arrow of arrowsAtRef) {
          const parsed = ReferenceUtils.tryParseReference(arrow.strReference)
          const currentSub = parsed?.subReference ?? 0
          if (currentSub >= subReference) {
            subReference = currentSub + 1
          }
        }

        const reference = ReferenceUtils.encodeReference(
          kind,
          targetRefNum,
          subReference,
        )
        const existingArrow = this.findAnnotationByStrReference(reference)
        return {
          reference,
          needsShift: !!existingArrow,
          shiftFromPosition:
            existingArrow && spatiallyNext
              ? { x: spatiallyNext.x, y: spatiallyNext.y }
              : null,
          spatiallyPreviousRef: spatiallyPrev.strReference,
        }
      }

      // No previous arrow group member — generate a new "NA" ref
      let targetRefNum: number
      if (spatiallyNext) {
        const nextParsed = ReferenceUtils.tryParseReference(
          spatiallyNext.strReference,
        )
        targetRefNum = nextParsed?.referenceNumber ?? 1
      } else {
        targetRefNum = maxRef + 1
      }

      const reference = ReferenceUtils.encodeReference(
        kind,
        targetRefNum,
        1, // First sub-reference (A)
      )
      const existingArrow = this.findAnnotationByStrReference(reference)
      return {
        reference,
        needsShift: !!existingArrow,
        shiftFromPosition:
          existingArrow && spatiallyNext
            ? { x: spatiallyNext.x, y: spatiallyNext.y }
            : null,
        spatiallyPreviousRef: null,
      }
    }

    // Strategy 1: Find a gap between neighbors
    const gapRef = findReferenceGap(existingRefs, prevRef, nextRef)
    if (gapRef !== null) {
      const reference = ReferenceUtils.encodeReference(kind, gapRef, null)
      return {
        reference,
        needsShift: false,
        shiftFromPosition: null,
        spatiallyPreviousRef: null,
      }
    }

    // Strategy 2: Check if we can safely shift spatially-after annotations
    if (spatiallyNext) {
      const nextParsed = ReferenceUtils.tryParseReference(
        spatiallyNext.strReference,
      )
      if (nextParsed) {
        // Find all annotations spatially at or after this point
        const spatiallyAfter = positions.filter(
          (p) => comparePositions(p, spatiallyNext!) >= 0,
        )

        // Find refs that are spatially BEFORE (won't be shifted)
        const spatiallyBeforeRefs = new Set(
          positions
            .filter((p) => comparePositions(p, spatiallyNext!) < 0)
            .map(
              (p) =>
                ReferenceUtils.tryParseReference(p.strReference)
                  ?.referenceNumber,
            )
            .filter((r): r is number => r !== undefined),
        )

        // Check if shifting would collide with any spatially-before refs
        const wouldCollide = spatiallyAfter.some((p) => {
          const ref = ReferenceUtils.tryParseReference(
            p.strReference,
          )?.referenceNumber
          return ref !== undefined && spatiallyBeforeRefs.has(ref + 1)
        })

        if (!wouldCollide) {
          // Safe to shift!
          const reference = ReferenceUtils.encodeReference(
            kind,
            nextParsed.referenceNumber,
            null,
          )
          return {
            reference,
            needsShift: true,
            shiftFromPosition: { x: spatiallyNext.x, y: spatiallyNext.y },
            spatiallyPreviousRef: null,
          }
        }
        // If would collide, fall through to Strategy 3
      }
    }

    // Strategy 3: Fall back to max + 1 (always safe)
    const reference = ReferenceUtils.encodeReference(kind, maxRef + 1, null)
    return {
      reference,
      needsShift: false,
      shiftFromPosition: null,
      spatiallyPreviousRef: null,
    }
  }

  /** Removes an annotation by string reference */
  async removeAnnotation(strReference: SingleReference): Promise<boolean> {
    return this.withOperationLock(async () => {
      const entry = this.findAnnotationByStrReference(strReference)
      if (!entry) {
        throw new Error('No matching annotation found!')
      }

      // Remove all annotation markers
      for (const annotationId of entry.annotationNodeId) {
        await NodeManager.removeNode(annotationId)
      }

      // First, update annotation info to handle group membership removal
      // All nodes are considered merged, so always update
      await InfoUtils.updateAnnotationInfo(this, entry, { delete: true })

      // Remove from internal state
      const entryIndex = this.state.annotations.findIndex(
        (annotation) => annotation.strReference === strReference,
      )

      if (entryIndex !== -1) {
        this.state.annotations.splice(entryIndex, 1)
      }

      return true
    })
  }

  /** Edits an existing annotation's properties using a string reference */
  async editAnnotation(
    referenceOrRecord: SingleReference | AnnotationRecord,
    options?: {
      newKind?: AnnotationKind
      newReference?: SingleReference
      properties?: Partial<Omit<AnnotationInfoProperties, 'reference' | 'kind'>>
    },
  ): Promise<AnnotationRecord> {
    return this.withOperationLock(async () => {
      let entry: AnnotationRecord
      if (typeof referenceOrRecord === 'string') {
        const foundEntry = this.findAnnotationByStrReference(referenceOrRecord)
        if (!foundEntry) {
          throw new Error(
            `No annotation found with reference: ${referenceOrRecord}!`,
          )
        }
        entry = foundEntry
      } else {
        entry = referenceOrRecord
      }

      const { newKind, newReference, properties } = options || {}

      const kindChanged = newKind !== undefined && newKind !== entry.kind
      const referenceChanged =
        newReference !== undefined && newReference !== entry.strReference
      const oldReference = entry.strReference
      let crossedBoundary = false

      // First handle kind change if needed
      if (kindChanged) {
        const result = this.changeAnnotationKind(entry, newKind!)
        const transitionOldRef = result.oldReference
        entry = result.record
        crossedBoundary = result.crossedBoundary

        // Update the entry in state array (reference may have changed)
        const stateIndex = this.state.annotations.findIndex(
          (a) => a.strReference === transitionOldRef,
        )
        if (stateIndex !== -1) {
          this.state.annotations[stateIndex] = entry
        }

        // Ensure marker consistency for this annotation
        await this.ensureMarkerConsistency(entry)
        const refChangedDuringTransition =
          entry.strReference !== transitionOldRef
        await InfoUtils.updateAnnotationInfo(this, entry, {
          oldReference: refChangedDuringTransition
            ? transitionOldRef
            : undefined,
        })
      }

      // Then handle reference change if needed
      if (referenceChanged) {
        const existingEntry = this.findAnnotationByStrReference(newReference!)
        if (
          existingEntry &&
          existingEntry !== entry &&
          existingEntry.kind === entry.kind
        ) {
          // DISPLACEMENT: Shift existing annotations to make room
          const decoded = ReferenceUtils.tryParseReference(newReference!)
          if (!decoded) {
            throw new Error(`Invalid reference format: ${newReference}`)
          }

          const isNavigation = ReferenceUtils.isNavigationKind(entry.kind)
          const isCompoundChange = decoded.subReference !== null

          let annotationsToShift: AnnotationRecord[]

          if (isCompoundChange) {
            // Compound reference change (e.g., "3A" → "3B"):
            // Only shift within the same arrow group (same referenceNumber, sub >= target)
            annotationsToShift = this.state.annotations.filter((a) => {
              if (a === entry) return false
              const parsed = ReferenceUtils.tryParseReference(a.strReference)
              if (!parsed || parsed.subReference === null) return false
              return (
                parsed.referenceNumber === decoded.referenceNumber &&
                parsed.subReference >= decoded.subReference!
              )
            })

            // Sort by subReference descending (shift highest first)
            annotationsToShift.sort((a, b) => {
              const aParsed = ReferenceUtils.tryParseReference(a.strReference)!
              const bParsed = ReferenceUtils.tryParseReference(b.strReference)!
              return (bParsed.subReference ?? 0) - (aParsed.subReference ?? 0)
            })

            // Shift each sub-reference up by 1
            for (const annotation of annotationsToShift) {
              const parsed = ReferenceUtils.tryParseReference(
                annotation.strReference,
              )!
              const newSubRef = (parsed.subReference ?? 0) + 1
              const newStringRef = ReferenceUtils.encodeReference(
                annotation.kind,
                parsed.referenceNumber,
                newSubRef,
              )
              annotation.strReference = newStringRef
              await this.ensureMarkerConsistency(annotation)
              await InfoUtils.updateAnnotationInfo(this, annotation)
            }
          } else {
            // Simple reference change (e.g., "2" → "3"):
            // Shift by main reference number, excluding compound-ref annotations
            annotationsToShift = this.state.annotations.filter((a) => {
              if (a === entry) return false
              if (ReferenceUtils.isNavigationKind(a.kind) !== isNavigation)
                return false
              const parsed = ReferenceUtils.tryParseReference(a.strReference)
              if (!parsed) return false
              return parsed.referenceNumber >= decoded.referenceNumber
            })

            // Sort in descending order so we shift highest first (avoids collisions)
            annotationsToShift.sort((a, b) => {
              const aParsed = ReferenceUtils.tryParseReference(a.strReference)!
              const bParsed = ReferenceUtils.tryParseReference(b.strReference)!
              return bParsed.referenceNumber - aParsed.referenceNumber
            })

            // Shift each annotation up by 1
            for (const annotation of annotationsToShift) {
              const parsed = ReferenceUtils.tryParseReference(
                annotation.strReference,
              )!
              const newRefNum = parsed.referenceNumber + 1
              const newStringRef = ReferenceUtils.encodeReference(
                annotation.kind,
                newRefNum,
                parsed.subReference,
              )
              annotation.strReference = newStringRef
              await this.ensureMarkerConsistency(annotation)
              await InfoUtils.updateAnnotationInfo(this, annotation)
            }
          }

          // Now update our entry's reference
          entry.strReference = newReference!
          this.sortState()
          await this.ensureMarkerConsistency(entry)
        } else {
          // No existing entry with target reference and kind
          entry.strReference = newReference!
          await this.ensureMarkerConsistency(entry)
        }
      }

      // Update any additional properties, checking if they actually differ
      let hasPropertyChanges = false
      if (properties) {
        for (const [key, value] of Object.entries(properties)) {
          const currentValue = (entry as Record<string, unknown>)[key]
          if (currentValue !== value) {
            hasPropertyChanges = true
            ;(entry as Record<string, unknown>)[key] = value
          }
        }
      }

      // Only update annotation info if something actually changed
      const hasChanges = kindChanged || referenceChanged || hasPropertyChanges
      if (hasChanges) {
        await InfoUtils.updateAnnotationInfo(this, entry, {
          oldReference: referenceChanged ? oldReference : undefined,
        })
      }

      // If we crossed the navigation/note boundary, regroup to fill gaps in old group
      if (crossedBoundary) {
        await this.regroupAnnotations()
      }

      return entry
    })
  }

  async bulkEditAnnotations(
    edits: {
      annotation: AnnotationRecord
      newReference: SingleReference
      newKind?: AnnotationKind
    }[],
  ): Promise<void> {
    return this.withOperationLock(async () => {
      // Validate no duplicate references in edits
      const allReferences = this.state.annotations.map((a) => a.strReference)
      for (const edit of edits) {
        const index = allReferences.findIndex((a) => a === edit.newReference)
        if (index !== -1) {
          allReferences[index] = edit.newReference
        }
      }
      const uniqueReferences = new Set(allReferences)
      if (uniqueReferences.size !== allReferences.length) {
        throw new Error(
          'Duplicate references found in bulk edit! Bulk edit cannot merge annotations.',
        )
      }
      // now apply all edits
      for (const edit of edits) {
        if (edit.newKind) {
          // Extract only the record's fields, not the entire KindTransitionResult
          // (which includes record, crossedBoundary, oldReference - copying 'record'
          // would create a circular reference when the kind is unchanged)
          const transitionResult = this.changeAnnotationKind(
            edit.annotation,
            edit.newKind,
          )
          Object.assign(edit.annotation, transitionResult.record)
        }
        edit.annotation.strReference = edit.newReference
      }
      await Promise.all(
        edits.map((edit) => this.ensureMarkerConsistency(edit.annotation)),
      )
      await InfoUtils.rebuildAnnotationInfoGroups(this)
    })
  }

  /**
   * Merges one annotation into another
   *
   * @param sourceRef Source annotation reference
   * @param targetRef Target annotation reference
   * @returns Success status
   * @throws Error if annotations are not found or incompatible
   */
  async mergeAnnotations(
    sourceRef: SingleReference,
    targetRef: SingleReference,
  ): Promise<boolean> {
    return this.withOperationLock(async () => {
      // Find both source and target annotations
      const sourceAnnotation = this.findAnnotationByStrReference(sourceRef)
      const targetAnnotation = this.findAnnotationByStrReference(targetRef)

      if (!sourceAnnotation) {
        throw new Error(
          `Source annotation with reference ${sourceRef} not found`,
        )
      }

      if (!targetAnnotation) {
        throw new Error(
          `Target annotation with reference ${targetRef} not found`,
        )
      }

      // Check if kinds are compatible
      if (sourceAnnotation.kind !== targetAnnotation.kind) {
        throw new Error(
          `Cannot merge annotations of different kinds: ${sourceAnnotation.kind} and ${targetAnnotation.kind}`,
        )
      }

      // Add source annotation nodes to target annotation
      const updatedAnnotationNodeIds = [
        ...targetAnnotation.annotationNodeId,
        ...sourceAnnotation.annotationNodeId,
      ]

      targetAnnotation.annotationNodeId = updatedAnnotationNodeIds
      sourceAnnotation.annotationNodeId = []

      await this.ensureMarkerConsistency(targetAnnotation)

      // Remove the source annotation
      const removeSuccess = await this.removeAnnotation(sourceRef)

      // Shift annotation references down to fill the gap
      if (removeSuccess) {
        // We use the source annotation's kind since that's what we're removing
        await this.shiftAnnotations(sourceRef, sourceAnnotation.kind, 'down')
      }

      return true
    })
  }

  async bulkDeleteAnnotations(references: SingleReference[]): Promise<void> {
    return this.withOperationLock(async () => {
      // we remove the markers, then the entries from state and finally call rebuildAnnotationInfoGroups
      for (const reference of references) {
        const entry = this.findAnnotationByStrReference(reference)
        if (!entry) {
          console.warn(
            `No matching annotation found for reference ${reference}, skipping deletion.`,
          )
          continue
        }

        // Remove all annotation markers
        for (const annotationId of entry.annotationNodeId) {
          await NodeManager.removeNode(annotationId)
        }

        // remove from internal state
        const entryIndex = this.state.annotations.findIndex(
          (annotation) => annotation.strReference === reference,
        )

        if (entryIndex !== -1) {
          this.state.annotations.splice(entryIndex, 1)
        }
      }

      await this.regroupAnnotations()
    })
  }

  /**
   * Changes the kind of an annotation record, preserving compatible fields and
   * setting appropriate defaults for the new kind.
   *
   * @param referenceOrRecord - String reference or the record to change kind
   * @param newKind - The new annotation kind to change to
   * @returns The updated annotation record
   */
  private changeAnnotationKind(
    referenceOrRecord: SingleReference | AnnotationRecord,
    newKind: AnnotationKind,
  ): KindTransitionResult {
    // Resolve the record if a string reference was passed
    let oldRecord: AnnotationRecord
    if (typeof referenceOrRecord === 'string') {
      const foundEntry = this.findAnnotationByStrReference(referenceOrRecord)
      if (!foundEntry) {
        throw new Error(
          `No annotation found with reference: ${referenceOrRecord}!`,
        )
      }
      oldRecord = foundEntry
    } else {
      oldRecord = referenceOrRecord
    }

    // Delegate to the extracted transition function with context
    return transitionAnnotationKind(oldRecord, newKind, {
      annotations: this.state.annotations,
    })
  }

  private async ensureMarkerConsistency(
    record: AnnotationRecord,
  ): Promise<void> {
    // For tab annotations with compound refs, first marker displays as tab (purple),
    // additional markers display as arrow (green) for per-marker display
    const isCompound = isArrowGroupMember(record)
    const promises = record.annotationNodeId.map((markerId, index) => {
      const displayKind: AnnotationKind =
        record.kind === 'tab' && isCompound && index > 0 ? 'arrow' : record.kind
      return NodeManager.updateAnnotationMarker(
        markerId,
        record,
        record.strReference,
        displayKind,
      )
    })
    await Promise.all(promises)
  }

  /** Reorders an annotation to a specific index position */
  async reorderAnnotationByIndex(
    currentStrReference: SingleReference,
    offset: -1 | 0, // before (-1) or after (0)
    targetIndex: number,
  ): Promise<void> {
    return this.withOperationLock(async () => {
      // Find the current annotation record
      const recordToMove =
        this.findAnnotationByStrReference(currentStrReference)
      if (!recordToMove) {
        throw new Error(
          `No annotation found with reference: ${currentStrReference}`,
        )
      }
      const parsedCurrentRef = ReferenceUtils.tryParseReference(
        recordToMove.strReference,
      )
      if (!parsedCurrentRef) {
        throw new Error(
          `Invalid reference format: ${recordToMove.strReference}`,
        )
      }

      // Determine if this is a navigation annotation
      const isNavigation = ReferenceUtils.isNavigationKind(recordToMove.kind)

      // Filter annotations by navigation type to match the front-end separation
      const relevantAnnotations = this.state.annotations.filter(
        (a) => ReferenceUtils.isNavigationKind(a.kind) === isNavigation,
      )

      // Sort the relevant annotations
      relevantAnnotations.sort((a, b) => this.compareAnnotations(a, b))

      // Find the current index in the relevant annotations array
      const currentIndex = relevantAnnotations.findIndex(
        (a) => a.strReference === recordToMove.strReference,
      )

      if (currentIndex === -1) {
        throw new Error(
          `Annotation with reference ${recordToMove.strReference} not found`,
        )
      }

      // Calculate the actual target position based on offset
      let actualTargetIndex = offset === 0 ? targetIndex + 1 : targetIndex

      // Remove the item from its current position
      const [itemToMove] = relevantAnnotations.splice(currentIndex, 1)

      // If moving forward (currentIndex < actualTargetIndex), adjust for shifted array
      if (currentIndex < actualTargetIndex) {
        actualTargetIndex--
      }

      // Prevent out of bounds target index
      if (
        actualTargetIndex < 0 ||
        actualTargetIndex > relevantAnnotations.length
      ) {
        throw new Error(`Target index ${actualTargetIndex} is out of bounds`)
      }

      // Check if the target annotation is an arrow or has arrows as neighbors
      const beforeAnnotation: AnnotationRecord | undefined =
        relevantAnnotations[actualTargetIndex - 1]
      const afterAnnotation: AnnotationRecord | undefined =
        relevantAnnotations[actualTargetIndex]
      const beforeAnnotationParsed = beforeAnnotation
        ? ReferenceUtils.tryParseReference(beforeAnnotation.strReference)
        : undefined
      const afterAnnotationParsed = afterAnnotation
        ? ReferenceUtils.tryParseReference(afterAnnotation.strReference)
        : undefined

      const reorderedAnnotations = relevantAnnotations as (
        | AnnotationRecord
        | {
            record: AnnotationRecord
            newKind: AnnotationKind
            placeholderReference?: SingleReference
          }
      )[]

      const beforeIsArrowGroup = beforeAnnotation
        ? isArrowGroupMember(beforeAnnotation)
        : false
      const afterIsArrowGroup = afterAnnotation
        ? isArrowGroupMember(afterAnnotation)
        : false

      if (
        beforeAnnotation &&
        afterAnnotation &&
        beforeIsArrowGroup &&
        afterIsArrowGroup
      ) {
        let placeholderReference: SingleReference
        if (
          beforeAnnotationParsed?.referenceNumber ===
            afterAnnotationParsed?.referenceNumber ||
          offset === -1
        ) {
          placeholderReference = ReferenceUtils.encodeReference(
            'arrow',
            beforeAnnotationParsed!.referenceNumber,
            1,
          )
        } else {
          placeholderReference = ReferenceUtils.encodeReference(
            'arrow',
            afterAnnotationParsed!.referenceNumber,
            1,
          )
        }
        reorderedAnnotations.splice(actualTargetIndex, 0, {
          record: itemToMove,
          newKind: 'arrow',
          placeholderReference,
        })
      } else {
        // Check if an arrow-group record is moving outside an arrow group
        if (
          isArrowGroupMember(itemToMove) &&
          !beforeIsArrowGroup &&
          !afterIsArrowGroup
        ) {
          // Keep as tab type but preserve showComponentName value
          const newKind = 'tab' as const

          reorderedAnnotations.splice(actualTargetIndex, 0, {
            record: itemToMove,
            newKind: newKind,
          })
        } else {
          reorderedAnnotations.splice(actualTargetIndex, 0, itemToMove)
        }
      }

      await this.internalRegroup([reorderedAnnotations])
      await InfoUtils.rebuildAnnotationInfoGroups(this)
    })
  }

  /** Reorders multiple annotations to a specific index position */
  async reorderMultipleAnnotationsByIndex(
    references: string[],
    offset: -1 | 0, // before (-1) or after (0)
    targetIndex: number,
  ): Promise<void> {
    return this.withOperationLock(async () => {
      if (references.length === 0) return

      // Find the first annotation to determine the group
      const firstRecord = this.findAnnotationByStrReference(references[0])
      if (!firstRecord) {
        throw new Error(`No annotation found with reference: ${references[0]}`)
      }

      // Determine if this is a navigation annotation
      const isNavigation = ReferenceUtils.isNavigationKind(firstRecord.kind)

      // Filter annotations by navigation type to match the front-end separation
      const relevantAnnotations = this.state.annotations.filter(
        (a) => ReferenceUtils.isNavigationKind(a.kind) === isNavigation,
      )

      // Sort the relevant annotations
      relevantAnnotations.sort((a, b) => this.compareAnnotations(a, b))

      // Create a set for O(1) lookup of selected references
      const selectedSet = new Set(references)

      // Get selected items in their current sorted order
      const selectedInOrder = relevantAnnotations.filter((a) =>
        selectedSet.has(a.strReference),
      )

      // Get remaining items (not selected)
      const remaining = relevantAnnotations.filter(
        (a) => !selectedSet.has(a.strReference),
      )

      // Calculate the actual insertion point in the remaining array
      // First, find how many selected items are before the target index
      let insertAt = offset === 0 ? targetIndex + 1 : targetIndex

      // Count how many selected items were removed before the target position
      const removedBeforeTarget = relevantAnnotations
        .slice(0, insertAt)
        .filter((a) => selectedSet.has(a.strReference)).length

      // Adjust insertion point
      insertAt -= removedBeforeTarget

      // Clamp to valid range
      insertAt = Math.max(0, Math.min(insertAt, remaining.length))

      // Build new order by inserting selected items at the target position
      const reorderedAnnotations = [
        ...remaining.slice(0, insertAt),
        ...selectedInOrder,
        ...remaining.slice(insertAt),
      ]

      await this.internalRegroup([reorderedAnnotations])
      await InfoUtils.rebuildAnnotationInfoGroups(this)
    })
  }

  /** Inserts annotation in sorted order */
  insertSortedAnnotation(record: AnnotationRecord): void {
    let idx = 0
    while (idx < this.state.annotations.length) {
      const cmp = this.compareAnnotations(record, this.state.annotations[idx])
      if (cmp < 0) break
      idx++
    }
    this.state.annotations.splice(idx, 0, record)
  }

  /** Compares two annotations for sorting */
  private compareAnnotations(a: AnnotationRecord, b: AnnotationRecord): number {
    return ReferenceUtils.compareReferences(
      a.strReference,
      b.strReference,
      a.kind,
      b.kind,
    )
  }

  /** Sorts the annotations array */
  private sortState(): void {
    this.state.annotations.sort((a, b) => this.compareAnnotations(a, b))
  }

  /** Shifts annotations to make room for insertion or fill gaps after deletion */
  public async shiftAnnotations(
    strTargetReference: SingleReference,
    kind: AnnotationKind,
    direction: 'up' | 'down' = 'up', // 'up' for insertion, 'down' for deletion
  ): Promise<void> {
    return this.withOperationLock(async () => {
      const decoded = ReferenceUtils.tryParseReference(strTargetReference)
      if (!decoded) {
        throw new Error(`Invalid reference format: ${strTargetReference}`)
      }

      const {
        referenceNumber: targetReference,
        subReference: targetSubReference,
      } = decoded

      // Pre-compute parsed references once for all annotations
      type ParsedRef = NonNullable<
        ReturnType<typeof ReferenceUtils.tryParseReference>
      >
      const refCache = new Map<string, ParsedRef>()
      for (const a of this.state.annotations) {
        const parsed = ReferenceUtils.tryParseReference(a.strReference)
        if (parsed) refCache.set(a.strReference, parsed)
      }

      if (targetSubReference !== null) {
        // Subnumber case (e.g. arrow keys)
        const annotationsToShift = this.state.annotations.filter((a) => {
          const parsed = refCache.get(a.strReference)
          return (
            parsed &&
            parsed.referenceNumber === targetReference &&
            parsed.subReference !== null &&
            (direction === 'up'
              ? parsed.subReference >= targetSubReference
              : parsed.subReference > targetSubReference)
          )
        })

        // Sort by subReference (use cached values)
        annotationsToShift.sort((a, b) => {
          const aParsed = refCache.get(a.strReference)!
          const bParsed = refCache.get(b.strReference)!
          return direction === 'up'
            ? (bParsed.subReference || 0) - (aParsed.subReference || 0)
            : (aParsed.subReference || 0) - (bParsed.subReference || 0)
        })

        for (const annotation of annotationsToShift) {
          const parsed = refCache.get(annotation.strReference)!
          if (parsed.subReference !== null) {
            const newSubRef =
              direction === 'up'
                ? parsed.subReference + 1
                : parsed.subReference - 1
            const newStringRef = ReferenceUtils.encodeReference(
              annotation.kind,
              parsed.referenceNumber,
              newSubRef > 0 ? newSubRef : null,
            )
            await this.editAnnotation(annotation, {
              newReference: newStringRef,
            })
          }
        }
      } else {
        // Main reference case (tabs, notes, etc)
        const isTargetNav = ReferenceUtils.isNavigationKind(kind)
        const annotationsToShift = this.state.annotations.filter((a) => {
          const parsed = refCache.get(a.strReference)
          return (
            parsed &&
            ReferenceUtils.isNavigationKind(a.kind) === isTargetNav &&
            (direction === 'up'
              ? parsed.referenceNumber >= targetReference
              : parsed.referenceNumber > targetReference)
          )
        })

        // Sort by reference (use cached values, sort in place)
        annotationsToShift.sort((a, b) => {
          const aParsed = refCache.get(a.strReference)!
          const bParsed = refCache.get(b.strReference)!
          return direction === 'up'
            ? bParsed.referenceNumber - aParsed.referenceNumber
            : aParsed.referenceNumber - bParsed.referenceNumber
        })

        for (const annotation of annotationsToShift) {
          const parsed = refCache.get(annotation.strReference)!
          const newRefNum =
            direction === 'up'
              ? parsed.referenceNumber + 1
              : parsed.referenceNumber - 1
          if (newRefNum < 1) continue // Don't assign zero or negative references
          const newStringRef = ReferenceUtils.encodeReference(
            annotation.kind,
            newRefNum,
            parsed.subReference,
          )
          await this.editAnnotation(annotation, { newReference: newStringRef })
        }
      }
    })
  }

  /**
   * Shifts annotations that are spatially at or after the given position. Only
   * shifts those in the same group (navigation vs notes). Shifts in reverse
   * reference order to avoid collisions.
   */
  async shiftAnnotationsSpatially(
    fromPosition: { x: number; y: number },
    kind: AnnotationKind,
  ): Promise<void> {
    return this.withOperationLock(async () => {
      const isNavigation = ReferenceUtils.isNavigationKind(kind)
      const group: AnnotationGroup = isNavigation ? 'navigation' : 'notes'

      const positions = await collectAnnotationPositions(
        this.state.annotations,
        group,
      )

      // Find annotations spatially at or after fromPosition
      const spatiallyAfter = positions.filter(
        (p) => comparePositions(p, fromPosition) >= 0,
      )

      // Sort by reference DESCENDING (shift highest first to avoid collisions)
      spatiallyAfter.sort((a, b) => {
        const aRef =
          ReferenceUtils.tryParseReference(a.strReference)?.referenceNumber ?? 0
        const bRef =
          ReferenceUtils.tryParseReference(b.strReference)?.referenceNumber ?? 0
        return bRef - aRef
      })

      // Shift each one up by 1
      for (const pos of spatiallyAfter) {
        const record = this.findAnnotationByStrReference(pos.strReference)
        if (!record) continue

        const parsed = ReferenceUtils.tryParseReference(record.strReference)
        if (!parsed) continue

        const newRef = ReferenceUtils.encodeReference(
          record.kind,
          parsed.referenceNumber + 1,
          parsed.subReference,
        )
        await this.editAnnotation(record, { newReference: newRef })
      }
    })
  }

  /**
   * Regroups annotations to remove any gaps in numbering For example, A, B, D,
   * F1, F2, F4, 1, 2, 4, 5 becomes A, B, C, E1, E2, E3, 1, 2, 3, 4
   */
  public async regroupAnnotations(): Promise<void> {
    return this.withOperationLock(async () => {
      // Group annotations by type: navigation (tab, component-tab, arrow) vs. note (note, component-note, presentational)
      const navigationAnnotations = this.state.annotations.filter((a) =>
        ReferenceUtils.isNavigationKind(a.kind),
      )
      const noteAnnotations = this.state.annotations.filter(
        (a) => !ReferenceUtils.isNavigationKind(a.kind),
      )

      // Sort each group
      navigationAnnotations.sort((a, b) => this.compareAnnotations(a, b))
      noteAnnotations.sort((a, b) => this.compareAnnotations(a, b))

      await this.internalRegroup([navigationAnnotations, noteAnnotations])
    })
  }

  private async internalRegroup(groups: RegroupInput[][]) {
    const edits = computeRegroupedReferences(groups)
    await this.bulkEditAnnotations(edits)
    this.sortState()
  }

  /** Regenerates internal state from Figma nodes */
  async regenerateState(): Promise<void> {
    // Snapshot of marker → reference before regeneration. Used after the rebuild
    // to detect canvas-side reference renames so we can reconcile info nodes —
    // plugin-initiated renames update state.annotations.strReference synchronously
    // before this runs, so they show no diff and won't re-trigger.
    const oldNodeRefMap = new Map<string, string>()
    for (const a of this.state.annotations) {
      for (const id of a.annotationNodeId) oldNodeRefMap.set(id, a.strReference)
    }

    // Fetch all annotations and info nodes
    const [annotations, annotationInfos] = await Promise.all([
      this.getAnnotations(),
      this.getAnnotationInfos(),
    ])

    // Group annotations and infos by reference
    const annotationMap = new Map<
      string,
      {
        annotations: AnnotationWrap[]
        info: AnnotationInfoWrap | null
        multiInfo: boolean
        infoGroupId?: string // Track which info group this reference belongs to
      }
    >()

    // Process annotation markers first
    for (const annotation of annotations) {
      const reference = ReferenceUtils.normalizeReference(annotation.reference)

      if (!annotationMap.has(reference)) {
        annotationMap.set(reference, {
          annotations: [],
          info: null,
          multiInfo: false,
        })
      }
      annotationMap.get(reference)!.annotations.push(annotation)
    }

    // Initialize merged info groups collection
    const newMergedInfoGroups: MergedInfoGroup[] = []
    // Track all references already in merged groups for O(1) lookup
    const referencesInGroups = new Set<string>()

    // Process annotation info nodes and create merged groups
    for (const info of annotationInfos) {
      const references = ReferenceUtils.parseComplexReference(info.reference)
      const multiInfo = references.length > 1
      const infoGroupId = `info-group-${info.id}`

      // Compute hash immediately from info node properties
      // Build a temporary record to compute consistent hash
      const tempRecord = this.createAnnotationRecord(
        {
          strReference: references[0] || '',
          annotationNodeId: [],
          kind: KindMapper.figmaToInternal(info.kind),
        },
        info,
      )
      const groupHash = getAnnotationHash(tempRecord)

      // Create a merged info group with computed hash
      newMergedInfoGroups.push({
        infoNodeId: info.id,
        references: new Set(references),
        hash: groupHash,
      })

      // Associate info with each referenced annotation in the map
      for (const reference of references) {
        // Track this reference as being in a merged group (normalized for consistent lookup)
        referencesInGroups.add(ReferenceUtils.normalizeReference(reference))

        if (annotationMap.has(reference)) {
          // Reference already has annotation markers
          annotationMap.get(reference)!.info = info
          annotationMap.get(reference)!.multiInfo = multiInfo
          annotationMap.get(reference)!.infoGroupId = infoGroupId
        } else {
          // Reference mentioned in info node but without markers
          annotationMap.set(reference, {
            annotations: [],
            info,
            multiInfo,
            infoGroupId,
          })
        }
      }
    }

    // Create annotation records from the collected data
    const newAnnotations: AnnotationRecord[] = []
    for (const [referenceStr, { annotations, info }] of annotationMap) {
      const cleanRef = ReferenceUtils.normalizeReference(referenceStr)

      // Determine kind and collect node IDs
      // For mixed kinds (e.g., tabNavigation + arrowKeyNavigation on same ref),
      // prefer tabNavigation — a tab annotation with compound ref can have
      // per-marker display where first marker is tab and rest are arrows
      let kindForDetermination: FigmaAnnotationKind
      let annotationIds: string[]

      if (annotations.length > 0) {
        const hasTabMarker = annotations.some((a) => a.kind === 'tabNavigation')
        kindForDetermination = hasTabMarker
          ? 'tabNavigation'
          : annotations[0].kind
        annotationIds = annotations.map((annotation) => annotation.id)
      } else if (info) {
        kindForDetermination = info.kind
        annotationIds = []
      } else {
        continue // Skip entries without any annotation or info
      }

      const recordKind = KindMapper.figmaToInternalWithReference(
        kindForDetermination,
        cleanRef,
      )
      const annotationInfoNodeId = info?.id || null

      const baseRecord: BaseAnnotationRecord = {
        strReference: cleanRef,
        annotationNodeId: annotationIds,
        kind: recordKind,
      }

      const record = this.createAnnotationRecord(baseRecord, info)

      // Check if this annotation is already part of a merged group (O(1) lookup)
      // Note: cleanRef is already normalized (line 1116)
      const isInMergedGroup = referencesInGroups.has(cleanRef)

      if (!isInMergedGroup) {
        // Create a new group for this standalone annotation
        newMergedInfoGroups.push({
          infoNodeId: annotationInfoNodeId,
          references: new Set([cleanRef]),
          hash: getAnnotationHash(record),
        })
      }
      newAnnotations.push(record)
    }

    // Drop ghost records (info node exists in Figma but no markers point to it)
    // so the UI never surfaces "0 items" entries.
    const filteredAnnotations = newAnnotations.filter(
      (a) => a.annotationNodeId.length > 0,
    )
    const hadGhostRecords = filteredAnnotations.length < newAnnotations.length

    // Update the component state
    this.state.annotations = filteredAnnotations
    this.infoGroupManager.replace(newMergedInfoGroups)
    this.sortState()

    // If a marker's reference changed on canvas (without going through the
    // plugin's edit path), or ghost records were filtered, info nodes are now
    // stale — rebuild them so they re-derive from current annotation content
    // and orphan info nodes in Figma are deleted.
    let referencesChanged = false
    for (const a of this.state.annotations) {
      for (const id of a.annotationNodeId) {
        const oldRef = oldNodeRefMap.get(id)
        if (oldRef !== undefined && oldRef !== a.strReference) {
          referencesChanged = true
          break
        }
      }
      if (referencesChanged) break
    }
    if (referencesChanged || hadGhostRecords) {
      await InfoUtils.rebuildAnnotationInfoGroups(this)
    }
  }

  /** Ensures annotation nodes are ordered correctly in Figma frames */
  async ensureFigmaOrder(): Promise<void> {
    // Make sure our state is sorted first
    this.sortState()

    // 1. Order annotation markers in the annotation frame
    const annotationFrame = await NodeManager.getAnnotationFrame(this)
    if (annotationFrame) {
      await orderAnnotationMarkers(this, annotationFrame)
    }

    // 2. Order annotation info nodes in their respective frames
    await orderInfoNodes(this, (kind) =>
      NodeManager.getAnnotationInfoFrame(this, kind),
    )
  }

  /** Creates the full annotation record with all fields based on kind */
  createAnnotationRecord(
    baseRecord: BaseAnnotationRecord,
    info: AnnotationInfoWrap | null,
  ): AnnotationRecord {
    const commonFields = {
      name: info?.name || AnnotationInfoWrap.getDefaultProperty('name'),
      role: info?.role || AnnotationInfoWrap.getDefaultProperty('role'),
      note: info?.note || AnnotationInfoWrap.getDefaultProperty('note'),
      componentName:
        info?.componentName ||
        AnnotationInfoWrap.getDefaultProperty('componentName'),
      showComponentName:
        info?.showComponentName ??
        AnnotationInfoWrap.getDefaultProperty('showComponentName'),
    }

    switch (baseRecord.kind) {
      case 'tab':
      case 'arrow':
        return { ...baseRecord, ...commonFields } as AnnotationRecord

      case 'note':
        return { ...baseRecord, ...commonFields } as AnnotationRecord

      case 'component-note':
        return {
          ...baseRecord,
          name: commonFields.name,
          note: commonFields.note,
          componentName: commonFields.componentName,
        } as AnnotationRecord

      case 'presentational':
        return { ...baseRecord } as AnnotationRecord

      default:
        return {
          ...baseRecord,
          kind: 'note',
          ...commonFields,
        } as AnnotationRecord
    }
  }
}
