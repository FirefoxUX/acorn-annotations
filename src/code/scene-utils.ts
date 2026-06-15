/** Pixels added on each side when an annotation marker is created with padding. */
export const MARKER_PADDING_PX = 8

const sceneUtils = {
  /**
   * Expand a position/size rect outward by `MARKER_PADDING_PX` on every side.
   * Used by both the manual "with padding" create path and the auto-annotation
   * `gap` flag.
   */
  applyMarkerPadding(
    position: [number, number],
    size: [number, number],
  ): { position: [number, number]; size: [number, number] } {
    return {
      position: [
        position[0] - MARKER_PADDING_PX,
        position[1] - MARKER_PADDING_PX,
      ],
      size: [size[0] + MARKER_PADDING_PX * 2, size[1] + MARKER_PADDING_PX * 2],
    }
  },

  /** Checks if a node is nested within a target frame */
  isNodeWithinFrame(node: SceneNode, targetFrame: FrameNode): boolean {
    let current: BaseNode | null = node.parent
    while (current) {
      if (current.id === targetFrame.id) {
        return true
      }
      current = current.parent
    }
    return false
  },

  /** Calculates the relative position of a node within a target frame */
  getRelativePosition(
    node: SceneNode,
    targetFrame: FrameNode,
  ): { x: number; y: number } {
    let relativeX = node.x
    let relativeY = node.y
    let current: BaseNode | null = node.parent

    // Walk up the parent chain until we reach targetFrame
    while (current && current.id !== targetFrame.id) {
      if ('x' in current && 'y' in current) {
        relativeX += current.x
        relativeY += current.y
      }
      current = current.parent
    }

    return { x: relativeX, y: relativeY }
  },

  /** Calculates the bounding box of multiple nodes relative to a target frame */
  calculateBoundingBox(
    nodes: readonly SceneNode[],
    targetFrame: FrameNode,
  ): {
    minX: number
    minY: number
    maxX: number
    maxY: number
    width: number
    height: number
  } {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    nodes.forEach((node) => {
      const relativePos = this.getRelativePosition(node, targetFrame)
      minX = Math.min(minX, relativePos.x)
      minY = Math.min(minY, relativePos.y)
      maxX = Math.max(maxX, relativePos.x + node.width)
      maxY = Math.max(maxY, relativePos.y + node.height)
    })

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    }
  },

  /** Validates that all nodes in a selection are within the target frame */
  validateNodesWithinFrame(
    nodes: readonly SceneNode[],
    targetFrame: FrameNode,
  ): { isValid: boolean; invalidNodes: SceneNode[] } {
    const invalidNodes = nodes.filter(
      (node) => !this.isNodeWithinFrame(node, targetFrame),
    )
    return {
      isValid: invalidNodes.length === 0,
      invalidNodes,
    }
  },

  findPageNode(node: SceneNode): PageNode | null {
    let current: BaseNode | null = node.parent
    while (current) {
      if (current.type === 'PAGE') {
        return current
      }
      current = current.parent
    }
    return null
  },
}

export default sceneUtils
