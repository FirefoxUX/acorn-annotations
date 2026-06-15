import { readable, type Readable } from 'svelte/store'
import { messenger } from '@src/message-handler'
import type { MergedInfoGroup, MergedInfoGroupSerialized } from '@src/types'

// We're using the MergedInfoGroup type from types.ts

// Create a readable store for the mergedInfoGroups that follows the same pattern as annotations store
export const mergedInfoGroups: Readable<MergedInfoGroup[]> = readable<
  MergedInfoGroup[]
>(
  // Initial value - empty array until we get actual data
  [],
  (set) => {
    // Use the existing debug-info-changed notification
    const unsubscribe = messenger.on(
      'debug-info-changed',
      (data: { mergedInfoGroups: MergedInfoGroupSerialized[] }) => {
        if (data && Array.isArray(data.mergedInfoGroups)) {
          // Convert array references to Sets for MergedInfoGroup
          const processedGroups = data.mergedInfoGroups.map(
            (group: MergedInfoGroupSerialized) => ({
              ...group,
              references: new Set(
                Array.isArray(group.references) ? group.references : [],
              ),
            }),
          )

          set(processedGroups as MergedInfoGroup[])
        }
      },
    )

    // Request current mergedInfoGroups state immediately using existing get-debug-info
    messenger
      .request('get-debug-info')
      .then((debugInfo: { mergedInfoGroups: MergedInfoGroupSerialized[] }) => {
        if (debugInfo && Array.isArray(debugInfo.mergedInfoGroups)) {
          const processedGroups = debugInfo.mergedInfoGroups.map(
            (group: MergedInfoGroupSerialized) => ({
              ...group,
              references: new Set(
                Array.isArray(group.references) ? group.references : [],
              ),
            }),
          )

          set(processedGroups as MergedInfoGroup[])
        }
      })
      .catch((error) => {
        console.error('[UI] Failed to get initial merged info groups:', error)
      })

    // Return cleanup function
    return unsubscribe
  },
)
