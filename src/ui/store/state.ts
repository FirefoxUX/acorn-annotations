import { readable, type Readable } from 'svelte/store'
import { messenger } from '@src/message-handler'
import type { PublicState } from '@src/types'
import { DEFAULT_STATE } from '@src/defaults'

// Create a readable store that syncs with the code side state
export const state: Readable<PublicState> = readable<PublicState>(
  // Initial value - will be replaced once we get the actual state
  DEFAULT_STATE,
  (set) => {
    // Keep track of current state for merging partial updates
    let currentState: PublicState = { ...DEFAULT_STATE }

    // Initialize by getting the current state from the code side
    messenger
      .request('get-state')
      .then((initialState) => {
        currentState = initialState
        set(initialState)
      })
      .catch((error) => {
        console.error('Failed to get initial state:', error)
      })

    // Listen for state changes from the code side
    const unsubscribe = messenger.on('state-change', (newState) => {
      // Update the store with partial state changes
      currentState = newState
      set(currentState)
    })

    // Return cleanup function
    return unsubscribe
  },
)
