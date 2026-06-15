import type {
  AnnotationKind,
  AnnotationRecord,
  FigmaAnnotationType,
  LockState,
  MultiReference,
  SingleReference,
} from '@src/types'
import {
  AnnotationWrap,
  AnnotationInfoWrap,
  type AnnotationInfoProperties,
} from '@code/annotation-components'
import { KindMapper } from './annotation-kind-mapper'
import { ReferenceUtils } from './annotation-reference-utils'
import type { AnnotationStateManager } from '.'

/** Handles creation, updates, and removal of annotation nodes in Figma */
const NodeManager = {
  /** Extracts annotation properties based on the annotation kind */
  extractAnnotationProperties(
    annotation: AnnotationRecord,
  ): Partial<Omit<AnnotationInfoProperties, 'reference' | 'kind'>> {
    const properties: Partial<
      Omit<AnnotationInfoProperties, 'reference' | 'kind'>
    > = {}

    switch (annotation.kind) {
      case 'tab':
      case 'arrow':
      case 'note': {
        const tabArrowNote = annotation as Extract<
          AnnotationRecord,
          { kind: 'tab' | 'arrow' | 'note' }
        >
        if (tabArrowNote.name !== undefined) properties.name = tabArrowNote.name
        if (tabArrowNote.role !== undefined) properties.role = tabArrowNote.role
        if (tabArrowNote.note !== undefined) properties.note = tabArrowNote.note
        if (tabArrowNote.componentName !== undefined)
          properties.componentName = tabArrowNote.componentName

        // Apply showComponentName logic based on the annotation kind
        if (annotation.kind === 'arrow' || annotation.kind === 'tab') {
          // For arrow and tab, always set (default to false if undefined)
          properties.showComponentName = tabArrowNote.showComponentName ?? false
        } else {
          // For note, always set to false
          properties.showComponentName = false
        }
        break
      }
      case 'component-note': {
        const componentNote = annotation as Extract<
          AnnotationRecord,
          { kind: 'component-note' }
        >
        if (componentNote.name !== undefined)
          properties.name = componentNote.name
        if (componentNote.note !== undefined)
          properties.note = componentNote.note
        if (componentNote.componentName !== undefined)
          properties.componentName = componentNote.componentName
        // Component-note always shows component name
        properties.showComponentName = true
        break
      }
      case 'presentational':
        // No specific properties for presentational
        properties.showComponentName = false
        break
    }

    return properties
  },
  /**
   * Creates a new annotation marker at the specified position. Optional
   * displayKind overrides the Figma kind for per-marker display.
   */
  async createAnnotationMarker(
    manager: AnnotationStateManager,
    position: [number, number],
    size: [number, number],
    annotation: AnnotationRecord,
    reference: SingleReference,
    type: FigmaAnnotationType | undefined,
    locked: boolean,
    displayKind?: AnnotationKind,
  ): Promise<AnnotationWrap> {
    const frame = await NodeManager.getAnnotationFrame(manager)
    if (!frame) throw new Error('Annotation frame not found')

    const topMarkerIndex = await this.getMarkerInsertionIndex(
      manager,
      annotation,
    )

    const effectiveKind = displayKind ?? annotation.kind
    return AnnotationWrap.create(
      position,
      size,
      frame,
      {
        kind: KindMapper.internalToFigmaForMarker(effectiveKind),
        reference,
        type: type,
      },
      topMarkerIndex,
      locked,
    )
  },

  /** Creates a new annotation info node */
  async createAnnotationInfo(
    manager: AnnotationStateManager,
    annotation: AnnotationRecord,
    reference: MultiReference,
  ): Promise<AnnotationInfoWrap> {
    const frame = await this.getAnnotationInfoFrame(manager, annotation)
    if (!frame) throw new Error('Annotation frame not found')

    const topInfoIndex = await NodeManager.getInfoInsertionIndex(
      frame,
      reference,
      annotation.kind,
    )

    // Extract properties based on annotation kind
    const properties = this.extractAnnotationProperties(annotation)

    return AnnotationInfoWrap.create(
      frame,
      {
        kind: KindMapper.internalToFigma(annotation.kind),
        reference,
        ...properties,
      },
      topInfoIndex,
    )
  },

  /**
   * Updates an annotation marker's properties. Optional displayKind overrides
   * the kind used for Figma marker display (used for per-marker display where
   * tab annotation's first marker = tab, rest = arrow)
   */
  async updateAnnotationMarker(
    nodeId: string,
    annotation: AnnotationRecord,
    reference: SingleReference,
    displayKind?: AnnotationKind,
  ): Promise<void> {
    const node = await figma.getNodeByIdAsync(nodeId)
    if (!node) {
      return
    }

    const wrap = new AnnotationWrap(node as InstanceNode)
    const effectiveKind = displayKind ?? annotation.kind
    const newKind = KindMapper.internalToFigmaForMarker(effectiveKind)
    wrap.updateProperties({
      kind: newKind,
      reference,
    })
  },

  /** Updates just the kind of an annotation marker */
  async updateAnnotationMarkerKind(
    nodeId: string,
    annotation: AnnotationRecord,
  ): Promise<void> {
    const node = await figma.getNodeByIdAsync(nodeId)
    if (!node) {
      return
    }

    const wrap = new AnnotationWrap(node as InstanceNode)
    const currentReference = wrap.reference
    const newKind = KindMapper.internalToFigmaForMarker(
      annotation.kind,
      currentReference,
    )
    wrap.updateProperties({
      kind: newKind,
    })
  },

  /** Updates an annotation info node's properties */
  async updateAnnotationInfo(
    nodeId: string | null,
    annotation: AnnotationRecord,
    reference: MultiReference,
  ): Promise<void> {
    if (!nodeId) return
    const node = await figma.getNodeByIdAsync(nodeId)
    if (!node) return

    // Extract properties based on annotation kind
    const properties = this.extractAnnotationProperties(annotation)

    const wrap = new AnnotationInfoWrap(node as InstanceNode)
    wrap.updateProperties({
      kind: KindMapper.internalToFigma(annotation.kind),
      reference,
      ...properties,
    })
  },

  /** Removes a node from the canvas */
  async removeNode(nodeId: string): Promise<void> {
    try {
      const node = await figma.getNodeByIdAsync(nodeId)
      if (node) {
        node.remove()
      }
    } catch (error) {
      console.warn(`Failed to remove node ${nodeId}:`, error)
    }
  },

  /** Gets the appropriate annotation info frame ID for a given annotation */
  getAnnotationInfoFrameId(
    manager: Pick<AnnotationStateManager, 'annotationInfoFrameId'>,
    annotation: AnnotationRecord | AnnotationKind,
  ): string {
    const annotationInfoFrameId = manager.annotationInfoFrameId
    const kind = typeof annotation === 'string' ? annotation : annotation.kind

    if (typeof annotationInfoFrameId === 'string') {
      return annotationInfoFrameId
    }
    return ReferenceUtils.isNavigationKind(kind)
      ? annotationInfoFrameId.navigation
      : annotationInfoFrameId.notes
  },

  /** Gets the frame node for annotation info based on annotation */
  async getAnnotationInfoFrame(
    manager: AnnotationStateManager,
    annotation: AnnotationRecord | AnnotationKind,
  ): Promise<FrameNode | null> {
    const frameId = NodeManager.getAnnotationInfoFrameId(manager, annotation)
    return (await figma.getNodeByIdAsync(frameId)) as FrameNode | null
  },

  /** Gets the annotation frame */
  async getAnnotationFrame(
    manager: AnnotationStateManager,
  ): Promise<FrameNode | null> {
    return (await figma.getNodeByIdAsync(
      manager.annotationFrameId,
    )) as FrameNode | null
  },

  /**
   * Calculates the proper insertion index for new annotation info nodes based
   * on reference order
   */
  async getInfoInsertionIndex(
    frame: FrameNode,
    reference: MultiReference,
    kind: AnnotationKind | AnnotationRecord,
  ): Promise<number> {
    // Extract kind if an AnnotationRecord was provided
    const actualKind = typeof kind === 'string' ? kind : kind.kind

    const infoNodes = frame.children
      .map((child, idx) => ({ child, idx }))
      .filter(({ child }) => AnnotationInfoWrap.isOfType(child)) as {
      child: InstanceNode
      idx: number
    }[]

    // If no info nodes, insert at top (index 0 or before any non-info nodes)
    if (infoNodes.length === 0) {
      const nonInfoNodes = frame.children.filter(
        (child) => !AnnotationInfoWrap.isOfType(child),
      )
      const insertionIndex =
        nonInfoNodes.length > 0 ? frame.children.indexOf(nonInfoNodes[0]) : 0
      return insertionIndex
    }

    // Find the correct index by reference order
    for (const { child, idx } of infoNodes) {
      const wrap = new AnnotationInfoWrap(child)
      const internalKind = KindMapper.figmaToInternal(wrap.kind)
      const cmp = ReferenceUtils.compareReferences(
        reference,
        wrap.reference,
        actualKind,
        internalKind,
      )
      if (cmp < 0) {
        return idx
      }
    }
    // If not less than any, insert after last info node
    const lastIdx = infoNodes[infoNodes.length - 1].idx + 1
    return lastIdx
  },

  /**
   * Gets the insertion index for annotation markers based on reference order In
   * Figma, lower indices are visually on top (index 0 is visually top-most)
   */
  async getMarkerInsertionIndex(
    manager: AnnotationStateManager,
    annotation: AnnotationRecord,
  ): Promise<number> {
    const frame = await NodeManager.getAnnotationFrame(manager)
    if (!frame) return 0

    // Iterate through all children
    for (let i = 0; i < frame.children.length; i++) {
      const child = frame.children[i]

      // Skip non-instance nodes
      if (child.type !== 'INSTANCE' || !AnnotationWrap.isOfType(child)) {
        continue
      }

      // Compare references
      const wrap = new AnnotationWrap(child)
      const comparison = ReferenceUtils.compareReferences(
        annotation.strReference,
        wrap.reference,
      )

      // If our annotation should come before this one, return this index
      if (comparison < 0) {
        return i
      }
    }

    // If we didn't find a place to insert, put it at the end
    return frame.children.length
  },

  /** Applies a lock state to the annotation frame's children */
  async applyLockState(
    manager: AnnotationStateManager,
    state: LockState,
  ): Promise<void> {
    const frame = await NodeManager.getAnnotationFrame(manager)
    if (!frame) return

    frame.children.forEach((child) => {
      const isAnnotation =
        child.type === 'INSTANCE' && AnnotationWrap.isOfType(child)

      switch (state) {
        case 'all-unlocked':
          child.locked = false
          break
        case 'design-locked':
          // Design frame locked, annotations unlocked
          child.locked = !isAnnotation
          break
        case 'annotations-locked':
          // Annotations locked, design frame unlocked
          child.locked = isAnnotation
          break
      }
    })
  },

  /** Detects the current lock state from the annotation frame's children */
  async detectLockState(manager: AnnotationStateManager): Promise<LockState> {
    const frame = await NodeManager.getAnnotationFrame(manager)
    if (!frame) return 'all-unlocked'

    const annotations = frame.children.filter(
      (child) => child.type === 'INSTANCE' && AnnotationWrap.isOfType(child),
    )
    const nonAnnotations = frame.children.filter(
      (child) => !(child.type === 'INSTANCE' && AnnotationWrap.isOfType(child)),
    )

    const annotationsAllLocked =
      annotations.length > 0 && annotations.every((c) => c.locked)
    const annotationsAllUnlocked =
      annotations.length === 0 || annotations.every((c) => !c.locked)
    const nonAnnotationsAllLocked =
      nonAnnotations.length > 0 && nonAnnotations.every((c) => c.locked)
    const nonAnnotationsAllUnlocked =
      nonAnnotations.length === 0 || nonAnnotations.every((c) => !c.locked)

    if (annotationsAllUnlocked && nonAnnotationsAllUnlocked)
      return 'all-unlocked'
    if (annotationsAllUnlocked && nonAnnotationsAllLocked)
      return 'design-locked'
    if (annotationsAllLocked && nonAnnotationsAllUnlocked)
      return 'annotations-locked'

    // Default on ambiguity
    return 'all-unlocked'
  },
}

export default NodeManager
