import type { AnnotationRecord, MergedInfoGroup } from '@src/types'
import { fastHash } from '@src/shared-utils'

/**
 * Computes a hash for an annotation record based on its content. Records with
 * identical hashes can share the same info node.
 */
export function getAnnotationHash(annotation: AnnotationRecord): number {
  const hashParts: string[] = [annotation.kind]

  switch (annotation.kind) {
    case 'tab':
    case 'arrow':
    case 'note':
      hashParts.push(annotation.name || '')
      hashParts.push(annotation.role || '')
      hashParts.push(annotation.note || '')
      if (annotation.kind === 'tab' || annotation.kind === 'arrow') {
        hashParts.push(annotation.showComponentName ? '1' : '0')
        if (annotation.showComponentName)
          hashParts.push(annotation.componentName || '')
      }
      break
    case 'component-note':
      hashParts.push(annotation.name || '')
      hashParts.push(annotation.note || '')
      hashParts.push(annotation.componentName || '')
      break
    case 'presentational':
      break
  }

  return fastHash(hashParts.join('-'))
}

/**
 * Manages merged info groups - collections of annotation references that share
 * the same info content and thus the same Figma info node.
 *
 * Works with an external array (from observable state) to maintain
 * compatibility with the existing change notification system.
 */
export class MergedInfoGroupManager {
  constructor(
    private getGroups: () => MergedInfoGroup[],
    private setGroups: (groups: MergedInfoGroup[]) => void,
  ) {}

  /** Read-only access to all groups */
  get all(): readonly MergedInfoGroup[] {
    return this.getGroups()
  }

  /** Number of groups */
  get length(): number {
    return this.getGroups().length
  }

  /** Adds a new merged info group */
  add(group: MergedInfoGroup): void {
    this.getGroups().push(group)
  }

  /** Removes a group by its hash */
  removeByHash(hash: number): boolean {
    const groups = this.getGroups()
    const index = groups.findIndex((g) => g.hash === hash)
    if (index !== -1) {
      groups.splice(index, 1)
      return true
    }
    return false
  }

  /** Removes a group by its info node ID */
  removeByInfoNodeId(infoNodeId: string): boolean {
    const groups = this.getGroups()
    const index = groups.findIndex((g) => g.infoNodeId === infoNodeId)
    if (index !== -1) {
      groups.splice(index, 1)
      return true
    }
    return false
  }

  /** Finds a group by its hash */
  findByHash(hash: number): MergedInfoGroup | undefined {
    return this.getGroups().find((g) => g.hash === hash)
  }

  /** Finds a group by its info node ID */
  findByInfoNodeId(infoNodeId: string): MergedInfoGroup | undefined {
    return this.getGroups().find((g) => g.infoNodeId === infoNodeId)
  }

  /** Finds a group that matches an annotation record's content hash */
  findMatchingRecord(record: AnnotationRecord): MergedInfoGroup | undefined {
    const hash = getAnnotationHash(record)
    return this.findByHash(hash)
  }

  /** Finds a group containing a specific reference */
  findByReference(reference: string): MergedInfoGroup | undefined {
    return this.getGroups().find((g) => g.references.has(reference))
  }

  /** Clears all groups */
  clear(): void {
    const groups = this.getGroups()
    groups.length = 0
  }

  /** Replaces all groups (used during state regeneration) */
  replace(newGroups: MergedInfoGroup[]): void {
    this.setGroups(newGroups)
  }

  /** Iterates over all groups */
  forEach(callback: (group: MergedInfoGroup) => void): void {
    this.getGroups().forEach(callback)
  }

  /** Returns groups as an iterable */
  [Symbol.iterator](): Iterator<MergedInfoGroup> {
    return this.getGroups()[Symbol.iterator]()
  }
}
