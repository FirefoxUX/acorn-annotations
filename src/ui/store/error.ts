import { writable } from 'svelte/store'
import {
  messenger,
  type MessageTypes,
  type FunctionMessageTypes,
} from '@src/message-handler'

export interface ErrorState {
  error: string | null
  isVisible: boolean
}

type DialogCallback = (options: {
  heading: string
  children: string
}) => Promise<void>

const initialState: ErrorState = {
  error: null,
  isVisible: false,
}

function createErrorStore() {
  const { subscribe, set, update } = writable<ErrorState>(initialState)

  let dialogCallback: DialogCallback | null = null

  return {
    subscribe,
    // Set the dialog callback function
    setDialogCallback: (callback: DialogCallback) => {
      dialogCallback = callback
    },
    // Show an error and automatically show dialog if callback is set
    showError: async (error: string) => {
      update(() => ({
        error,
        isVisible: true,
      }))

      // Automatically show dialog if callback is available
      if (dialogCallback) {
        await dialogCallback({
          heading: 'Error',
          children: error,
        })
        // Clear error after dialog is closed
        set(initialState)
      }
    },
    // Set error internally (used by safeRequest)
    setError: (error: Error) => {
      const errorMessage = error.message || String(error)
      update(() => ({
        error: errorMessage,
        isVisible: true,
      }))

      // Automatically show dialog if callback is available
      if (dialogCallback) {
        dialogCallback({
          heading: 'Error',
          children: errorMessage,
        }).then(() => {
          // Clear error after dialog is closed
          set(initialState)
        })
      }
    },
    // Clear the error
    clearError: () => {
      set(initialState)
    },
    // Safe request wrapper that handles errors globally
    safeRequest: async <T extends keyof MessageTypes>(
      type: T,
      ...args: Parameters<FunctionMessageTypes[T]>
    ): Promise<MessageTypes[T]['response'] | null> => {
      try {
        const response = await messenger.request(type, ...args)

        // Check if response is an object containing an error key
        if (
          typeof response === 'object' &&
          response !== null &&
          'error' in response &&
          response.error
        ) {
          console.error(`Error in request ${type}:`, response.error)
          const errorObj = new Error(response.error as string)

          // Use setError method to handle dialog automatically
          const errorMessage = errorObj.message || String(errorObj)
          update(() => ({
            error: errorMessage,
            isVisible: true,
          }))

          // Show dialog if callback is available
          if (dialogCallback) {
            dialogCallback({
              heading: 'Error',
              children: errorMessage,
            }).then(() => {
              set(initialState)
            })
          }

          return null
        }

        return response
      } catch (error) {
        // Handle unexpected errors (network issues, etc.)
        console.error(`Error in request ${type}:`, error)
        const errorMessage =
          error instanceof Error ? error.message : String(error)

        update(() => ({
          error: errorMessage,
          isVisible: true,
        }))

        // Show dialog if callback is available
        if (dialogCallback) {
          dialogCallback({
            heading: 'Error',
            children: errorMessage,
          }).then(() => {
            set(initialState)
          })
        }

        return null
      }
    },
  }
}

export const errorStore = createErrorStore()
