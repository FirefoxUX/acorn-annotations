import type { FigmaMessageHandler } from '@src/message-handler'
import type { AnnotationKind, PublicState } from '@src/types'
import type { AnnotationStateManager } from '../annotation-state-manager'
import sceneUtils from '../scene-utils'
import { AnnotationWrap, AnnotationInfoWrap } from '../annotation-components'
import {
  findByFigmaKey,
  resolveAutoAnnotationKind,
  type ComponentMapEntry,
} from '@src/component-map'

type ManagerGetter = () => AnnotationStateManager | null
type HandleError = (error: unknown, operation: string) => { error: string }

type AutoCandidate = {
  kind: AnnotationKind
  /** Set when the annotation should auto-fill `componentName` (component-notes). */
  componentName: string | null
  position: [number, number]
  size: [number, number]
}

type Rect = { x: number; y: number; w: number; h: number }

export function registerAutoAnnotateHandlers(
  messenger: FigmaMessageHandler,
  publicState: PublicState,
  getManager: ManagerGetter,
  handleError: HandleError,
): void {
  messenger.on('auto-annotate-acorn-components', () =>
    autoAnnotate(publicState, getManager, handleError, false),
  )
  messenger.on('auto-annotate-all-components', () =>
    autoAnnotate(publicState, getManager, handleError, true),
  )
}

export async function autoAnnotateAcornComponents(
  publicState: PublicState,
  getManager: ManagerGetter,
  handleError: HandleError,
) {
  return autoAnnotate(publicState, getManager, handleError, false)
}

export async function autoAnnotateAllComponents(
  publicState: PublicState,
  getManager: ManagerGetter,
  handleError: HandleError,
) {
  return autoAnnotate(publicState, getManager, handleError, true)
}

async function autoAnnotate(
  publicState: PublicState,
  getManager: ManagerGetter,
  handleError: HandleError,
  includeUnknown: boolean,
): Promise<
  { success: true; created: number; skipped: number } | { error: string }
> {
  const manager = getManager()
  if (!manager) {
    return {
      error:
        'Annotation state manager not initialized. Please start annotation mode first.',
    }
  }
  if (!publicState.frames.annotationFrame) {
    return { error: 'Annotation frame not found' }
  }

  const appendFrame = (await figma.getNodeByIdAsync(
    publicState.frames.annotationFrame.id,
  )) as FrameNode | null
  if (!appendFrame || appendFrame.type !== 'FRAME') {
    return { error: 'Annotation frame not found or is not a frame.' }
  }

  try {
    const candidates: AutoCandidate[] = []
    await collectCandidates(
      appendFrame,
      appendFrame,
      includeUnknown,
      candidates,
    )

    const occupied = await collectExistingMarkerRects(manager, appendFrame)
    const survivors = candidates.filter(
      (c) =>
        !occupied.some((r) =>
          rectsOverlap(
            { x: c.position[0], y: c.position[1], w: c.size[0], h: c.size[1] },
            r,
          ),
        ),
    )

    // Sort top-to-bottom, left-to-right so references read naturally.
    survivors.sort((a, b) => {
      const yDiff = a.position[1] - b.position[1]
      return Math.abs(yDiff) <= 20 ? a.position[0] - b.position[0] : yDiff
    })

    let created = 0
    for (const c of survivors) {
      try {
        const posRef = await manager.calculatePositionBasedReference(c.kind, {
          x: c.position[0],
          y: c.position[1],
        })
        if (posRef.needsShift && posRef.shiftFromPosition) {
          await manager.shiftAnnotationsSpatially(
            posRef.shiftFromPosition,
            c.kind,
          )
        }

        const { record } = await manager.addNewAnnotationWithShift(
          c.kind,
          posRef.reference,
          c.position,
          c.size,
          false,
          'area',
          false,
        )

        // Auto-fill componentName for any kind that supports it (tab / arrow /
        // component-note). For tabs we also flip showComponentName on so the
        // label is visible in the marker.
        if (
          c.componentName &&
          (c.kind === 'tab' ||
            c.kind === 'arrow' ||
            c.kind === 'component-note')
        ) {
          try {
            await manager.editAnnotation(record.strReference, {
              properties: {
                componentName: c.componentName,
                showComponentName: true,
              },
            })
          } catch {
            // Non-critical — annotation was created, just missing component name.
          }
        }

        created++
      } catch (error) {
        console.warn('Auto-annotate: failed to create annotation', error)
      }
    }

    figma.commitUndo()
    return {
      success: true,
      created,
      skipped: candidates.length - created,
    } as const
  } catch (error) {
    return handleError(error, 'auto-annotate components')
  }
}

/**
 * Plain-boolean wrapper around the AnnotationWrap / AnnotationInfoWrap type
 * guards. The underlying guards narrow the input to `InstanceNode`, which
 * incorrectly excludes ALL instance children from the rest of the loop — but
 * only annotation markers should be skipped. Returning `boolean` here preserves
 * the original `SceneNode` type for subsequent code.
 */
function isAnnotationMarker(node: SceneNode): boolean {
  return AnnotationWrap.isOfType(node) || AnnotationInfoWrap.isOfType(node)
}

async function collectCandidates(
  parent: SceneNode | FrameNode,
  appendFrame: FrameNode,
  includeUnknown: boolean,
  out: AutoCandidate[],
): Promise<void> {
  if (!('children' in parent)) return

  for (const child of parent.children) {
    if (isAnnotationMarker(child)) continue
    // Hidden layers are not part of the visible design — skip them and
    // anything nested inside.
    if (!child.visible) continue

    if (child.type === 'INSTANCE') {
      const classified = await classifyInstance(child, includeUnknown)
      if (classified) {
        const relPos = sceneUtils.getRelativePosition(child, appendFrame)
        const base = {
          position: [relPos.x, relPos.y] as [number, number],
          size: [child.width, child.height] as [number, number],
        }
        const { position, size } = classified.gap
          ? sceneUtils.applyMarkerPadding(base.position, base.size)
          : base
        out.push({
          kind: classified.kind,
          componentName: classified.componentName,
          position,
          size,
        })
      }
    }

    // Recurse — nested matches inside containers (and inside other matches)
    // should also be annotated.
    if ('children' in child) {
      await collectCandidates(child, appendFrame, includeUnknown, out)
    }
  }
}

type Classified = {
  kind: AnnotationKind
  componentName: string | null
  gap: boolean
}

async function classifyInstance(
  node: InstanceNode,
  includeUnknown: boolean,
): Promise<Classified | null> {
  const mainComponent = await node.getMainComponentAsync()
  if (!mainComponent) return null

  const componentSet =
    mainComponent.parent?.type === 'COMPONENT_SET'
      ? (mainComponent.parent as ComponentSetNode)
      : null
  const parentKey = componentSet?.key ?? null

  const entry: ComponentMapEntry | undefined = parentKey
    ? (findByFigmaKey(parentKey) ?? findByFigmaKey(mainComponent.key))
    : findByFigmaKey(mainComponent.key)

  if (entry) {
    const resolved = resolveAutoAnnotationKind(entry)
    if (resolved === 'skip') return null
    const gap = entry.gap ?? false
    // 'note' in the map = the notes group → use `component-note` so the
    // technical name shows. Tabs keep their own kind but still display the
    // component name.
    if (resolved === 'note' || resolved === 'component-note') {
      return {
        kind: 'component-note',
        componentName: entry.technicalName,
        gap,
      }
    }
    // resolved === 'tab'
    return { kind: 'tab', componentName: entry.technicalName, gap }
  }

  if (!includeUnknown) return null

  // Unknown components fall back to the component set name (or main component
  // name) so the auto-filled label is the canonical component name rather than
  // a variant property string.
  const componentName = componentSet?.name ?? mainComponent.name

  // In "all" mode, icon components add a lot of noise — they're typically used
  // as building blocks inside other components and don't need their own
  // annotation. Skip anything with "icon" in the component name.
  if (/icon/i.test(componentName)) return null

  return { kind: 'component-note', componentName, gap: false }
}

async function collectExistingMarkerRects(
  manager: AnnotationStateManager,
  appendFrame: FrameNode,
): Promise<Rect[]> {
  const rects: Rect[] = []
  for (const annotation of manager.annotations) {
    for (const nodeId of annotation.annotationNodeId) {
      // Annotation markers are always INSTANCE nodes, so width / height exist.
      const node = (await figma.getNodeByIdAsync(nodeId)) as InstanceNode | null
      if (!node || node.removed) continue
      const pos = sceneUtils.getRelativePosition(node, appendFrame)
      rects.push({
        x: pos.x,
        y: pos.y,
        w: node.width,
        h: node.height,
      })
    }
  }
  return rects
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  )
}
