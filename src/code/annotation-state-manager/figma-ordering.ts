import { AnnotationInfoWrap, AnnotationWrap } from '@code/annotation-components'
import type { AnnotationRecord, MergedInfoGroup } from '@src/types'
import { ReferenceUtils } from './annotation-reference-utils'
import { KindMapper } from './annotation-kind-mapper'
import NodeManager from './annotation-node-manager'

interface OrderingContext {
  readonly annotationInfoFrameId: string | { navigation: string; notes: string }
  readonly annotations: AnnotationRecord[]
  readonly infoGroupManager: {
    findMatchingRecord(record: AnnotationRecord): MergedInfoGroup | undefined
  }
}

/**
 * Orders annotation markers in the annotation frame. Markers are sorted by
 * their reference and positioned after non-annotation elements.
 */
export async function orderAnnotationMarkers(
  context: OrderingContext,
  annotationFrame: FrameNode,
): Promise<void> {
  // Separate annotation instances from other elements
  const nonAnnotationElements = annotationFrame.children.filter(
    (child) => !(child.type === 'INSTANCE' && AnnotationWrap.isOfType(child)),
  )

  const annotationWrappers: {
    wrap: AnnotationWrap
    sortKey: string
  }[] = []

  // Collect annotation wrappers with their sort keys
  for (const annotation of context.annotations) {
    for (const annotationId of annotation.annotationNodeId) {
      try {
        const node = await figma.getNodeByIdAsync(annotationId)
        if (node) {
          const wrap = new AnnotationWrap(node as InstanceNode)
          annotationWrappers.push({
            wrap,
            sortKey: annotation.strReference,
          })
        }
      } catch (_e) {
        // Ignore missing nodes
      }
    }
  }

  // Sort by reference (later references at top visually)
  annotationWrappers.sort((a, b) =>
    ReferenceUtils.compareReferences(a.sortKey, b.sortKey),
  )

  // Insert after non-annotation elements
  const startIndex = nonAnnotationElements.length
  for (let i = 0; i < annotationWrappers.length; i++) {
    annotationWrappers[i].wrap.insertIntoFrame(annotationFrame, startIndex + i)
  }
}

/**
 * Orders annotation info nodes in a single info frame. Info nodes are sorted by
 * their first reference and positioned after non-info elements.
 */
async function orderInfoNodesInFrame(
  context: OrderingContext,
  frame: FrameNode,
): Promise<void> {
  // Separate info instances from other elements
  const nonInfoElements: SceneNode[] = []
  const infoWrappers: {
    wrap: AnnotationInfoWrap
    reference: string
    firstRef: string
  }[] = []

  // Collect non-annotation-info elements
  for (const child of frame.children) {
    if (!(child.type === 'INSTANCE' && AnnotationInfoWrap.isOfType(child))) {
      nonInfoElements.push(child)
    }
  }

  // Collect info nodes for annotations in this frame
  for (const record of context.annotations) {
    if (
      NodeManager.getAnnotationInfoFrameId(context, record.kind) === frame.id
    ) {
      try {
        const group = context.infoGroupManager.findMatchingRecord(record)
        if (!group || !group.infoNodeId) continue

        const node = await figma.getNodeByIdAsync(group.infoNodeId)
        if (node) {
          const wrap = new AnnotationInfoWrap(node as InstanceNode)

          // Get the first reference from potentially complex reference
          const parsedRefs = ReferenceUtils.parseComplexReference(
            wrap.reference,
          )
          const firstRef =
            parsedRefs.length > 0 ? parsedRefs[0] : wrap.reference

          // Only add if not already in list (shared info nodes)
          if (!infoWrappers.some((w) => w.wrap.id === wrap.id)) {
            infoWrappers.push({
              wrap,
              reference: wrap.reference,
              firstRef,
            })
          }
        }
      } catch (_e) {
        // Ignore missing nodes
      }
    }
  }

  // Sort by kind-aware reference comparison
  infoWrappers.sort((a, b) => {
    const aKind = KindMapper.figmaToInternal(a.wrap.kind)
    const bKind = KindMapper.figmaToInternal(b.wrap.kind)
    return ReferenceUtils.compareReferences(
      a.firstRef,
      b.firstRef,
      aKind,
      bKind,
    )
  })

  // Move non-info elements to bottom (insert at index 0)
  for (const element of nonInfoElements) {
    if (element.parent === frame) {
      const idx = frame.children.indexOf(element)
      if (idx !== -1) {
        frame.insertChild(0, element)
      }
    }
  }

  // Insert info nodes in sorted order
  const baseIndex = nonInfoElements.length
  infoWrappers.reverse()
  for (let i = 0; i < infoWrappers.length; i++) {
    infoWrappers[i].wrap.insertIntoFrame(frame, baseIndex)
  }
}

/**
 * Orders annotation info nodes in the info frame(s). Handles both single frame
 * and split navigation/notes frames.
 */
export async function orderInfoNodes(
  context: OrderingContext,
  getInfoFrame: (kind: 'tab' | 'note') => Promise<FrameNode | null>,
): Promise<void> {
  const infoFrames: (FrameNode | null)[] = []

  if (typeof context.annotationInfoFrameId === 'string') {
    // Single frame mode
    infoFrames.push(await getInfoFrame('tab'))
  } else {
    // Split frame mode
    infoFrames.push(await getInfoFrame('tab'), await getInfoFrame('note'))
  }

  for (const frame of infoFrames) {
    if (frame) {
      await orderInfoNodesInFrame(context, frame)
    }
  }
}
