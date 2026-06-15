import type * as code from './code'
import type {
  AnnotationKind,
  LockState,
  PublicState,
  AnnotationRecord,
  MergedInfoGroupSerialized,
} from './types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FunctionToMessage<T extends (...args: any[]) => any> = {
  data: Parameters<T>
  response: ReturnType<T>
}

type NotificationMessage<TData> = {
  data: TData
  response: void
}

/**
 * Message type definitions for the public API between UI and Plugin contexts.
 *
 * Uses Msg<PublicFn> which maps a function's Parameters to data and ReturnType
 * to response. The public function signature must match the parameters the UI
 * sends (excluding injected dependencies like publicState, getManager,
 * handleError, etc.).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Msg<T extends (...args: any[]) => any> = FunctionToMessage<T>

export interface MessageTypes {
  // UI to Plugin messages: frame setup
  'set-frame': Msg<
    (
      kind: 'annotation' | 'info' | 'info-navigation' | 'info-notes',
    ) => ReturnType<typeof code.setFrame>
  >
  'create-info-frame': Msg<() => ReturnType<typeof code.createInfoFrame>>
  'start-annotation': Msg<() => ReturnType<typeof code.startAnnotation>>
  'return-to-frame-selection': Msg<
    () => ReturnType<typeof code.returnToFrameSelection>
  >

  // State & data queries (no injected params)
  'get-state': FunctionToMessage<typeof code.getState>
  'get-annotations': FunctionToMessage<typeof code.getAnnotations>
  'get-debug-info': Msg<() => ReturnType<typeof code.getDebugInfo>>

  // Mode & settings
  'set-mode': Msg<
    (mode: 'desktop' | 'mobile') => ReturnType<typeof code.setMode>
  >
  'set-annotation-type': Msg<
    (type: AnnotationKind) => ReturnType<typeof code.setAnnotationType>
  >
  'set-annotation-mode': Msg<
    (
      mode: 'displace-group' | 'displace-multi',
    ) => ReturnType<typeof code.setAnnotationMode>
  >
  'set-split-info-frame': Msg<
    (split: boolean) => ReturnType<typeof code.setSplitInfoFrame>
  >
  'set-selection-grouping': Msg<
    (
      value: 'entire' | 'individual',
    ) => ReturnType<typeof code.setSelectionGrouping>
  >

  // Annotation CRUD
  'create-annotation': Msg<
    (
      multi: boolean,
      padding: boolean,
    ) => ReturnType<typeof code.createAnnotationFromSelection>
  >
  'add-to-annotation': Msg<
    (
      strReference: string,
      multi: boolean,
      padding: boolean,
    ) => ReturnType<typeof code.addToAnnotationFromSelection>
  >
  'delete-annotation': Msg<
    (strReference: string) => ReturnType<typeof code.deleteAnnotation>
  >
  'delete-multiple-annotations': Msg<
    (
      strReferences: string[],
    ) => ReturnType<typeof code.deleteMultipleAnnotations>
  >
  'update-multiple-annotations': Msg<
    (
      strReferences: string[] | string,
      updatedAnnotation: AnnotationRecord,
      newReference?: string,
    ) => ReturnType<typeof code.updateMultipleAnnotations>
  >
  'merge-annotation': Msg<
    (
      sourceRef: string,
      targetRef: string,
    ) => ReturnType<typeof code.mergeAnnotation>
  >
  'regroup-annotations': Msg<() => ReturnType<typeof code.regroupAnnotations>>
  'auto-annotate-acorn-components': Msg<
    () => ReturnType<typeof code.autoAnnotateAcornComponents>
  >
  'auto-annotate-all-components': Msg<
    () => ReturnType<typeof code.autoAnnotateAllComponents>
  >
  'reorder-annotation-by-index': Msg<
    (
      currentStrReference: string,
      position: -1 | 0,
      targetIndex: number,
    ) => ReturnType<typeof code.reorderAnnotationByIndex>
  >
  'reorder-multiple-annotations-by-index': Msg<
    (
      references: string[],
      position: -1 | 0,
      targetIndex: number,
    ) => ReturnType<typeof code.reorderMultipleAnnotationsByIndex>
  >
  'select-annotation-markers': Msg<
    (strReference: string) => ReturnType<typeof code.selectAnnotationMarkers>
  >

  // UI controls
  'select-scene-node': FunctionToMessage<typeof code.selectSceneNode>
  'refresh-selection': Msg<() => { success: true }>
  'toggle-sidebar': Msg<
    (view?: 'help' | 'debug' | null) => ReturnType<typeof code.toggleSidebar>
  >
  'toggle-lock-annotations': Msg<
    () => ReturnType<typeof code.toggleLockAnnotations>
  >
  'set-lock-state': Msg<
    (state: LockState) => ReturnType<typeof code.setLockState>
  >
  'open-external-link': Msg<
    (url: string) => ReturnType<typeof code.openExternalLink>
  >

  // Saved groups
  'get-saved-groups': Msg<() => ReturnType<typeof code.getSavedGroups>>
  'load-saved-group': Msg<
    (groupId: string) => ReturnType<typeof code.loadSavedGroup>
  >
  'delete-saved-group': Msg<
    (groupId: string) => ReturnType<typeof code.deleteSavedGroup>
  >
  'rename-saved-group': Msg<
    (
      groupId: string,
      newName: string,
    ) => ReturnType<typeof code.renameSavedGroup>
  >
  'skip-to-frame-selection': Msg<
    () => ReturnType<typeof code.skipToFrameSelection>
  >

  // Plugin to UI messages (notifications without expected response)
  'selection-changed': NotificationMessage<{
    count: number
    references: string[]
    frameKind: 'annotation' | 'info' | null
  }>
  'state-change': NotificationMessage<PublicState>
  'annotations-changed': NotificationMessage<AnnotationRecord[]>
  'debug-info-changed': NotificationMessage<{
    mergedInfoGroups: MergedInfoGroupSerialized[]
  }>

  // UI to Plugin notifications (fire-and-forget, no response expected)
  'resize-window': NotificationMessage<{ mainWidth: number; height: number }>
}

// Extract function message types (exclude notification-only messages)
export type FunctionMessageTypes = {
  [K in keyof MessageTypes]: MessageTypes[K] extends FunctionToMessage<infer T>
    ? T
    : never
}

type MessageType = keyof MessageTypes

interface BaseMessage {
  type: MessageType
  id?: string
  data?: unknown
  isResponse?: boolean
}

interface ResponseMessage extends BaseMessage {
  isResponse: true
  requestId: string
}

export class FigmaMessageHandler {
  private static instance: FigmaMessageHandler | null = null

  private isUI: boolean
  private pendingRequests = new Map<
    string,
    {
      resolve: (value: unknown) => void
      reject: (reason?: unknown) => void
    }
  >()
  // Type erasure for runtime - handlers will be properly typed at call sites
  private messageListeners = new Map<
    MessageType,
    Array<(data: unknown) => unknown>
  >()
  private messageIdCounter = 0

  private constructor() {
    this.isUI = typeof figma === 'undefined'
    this.setupMessageListener()
  }

  static getInstance(): FigmaMessageHandler {
    if (!FigmaMessageHandler.instance) {
      FigmaMessageHandler.instance = new FigmaMessageHandler()
    }
    return FigmaMessageHandler.instance
  }

  private setupMessageListener() {
    if (this.isUI) {
      // UI context
      window.onmessage = (event) => {
        this.handleMessage(event.data.pluginMessage)
      }
    } else {
      // Plugin context
      figma.ui.onmessage = (message) => {
        this.handleMessage(message)
      }
    }
  }

  private handleMessage(message: BaseMessage) {
    if (message.isResponse) {
      // Handle response to a previous request
      const responseMsg = message as ResponseMessage
      const pending = this.pendingRequests.get(responseMsg.requestId)
      if (pending) {
        pending.resolve(responseMsg.data)
        this.pendingRequests.delete(responseMsg.requestId)
      }
    } else {
      // Handle new message
      this.notifyListeners(message.type, message.data, message.id)
    }
  }

  private notifyListeners(
    type: MessageType,
    data: unknown,
    requestId?: string,
  ) {
    const listeners = this.messageListeners.get(type) || []
    listeners.forEach((listener) => {
      // For function calls (with requestId), spread array data as arguments
      // For notifications (without requestId), always pass data as single parameter
      let result: unknown
      if (requestId && Array.isArray(data)) {
        // Use type assertion for spreading - runtime will handle the actual types
        result = (listener as (...args: unknown[]) => unknown)(...data)
      } else {
        result = listener(data)
      }

      // If this message expects a response and we have a requestId, send response
      if (requestId && result !== undefined) {
        if (result instanceof Promise) {
          result
            .then((responseData) => {
              this.sendResponse(requestId, responseData)
            })
            .catch((error) => {
              // Create a proper error response based on the message type
              const errorResponse = this.createErrorResponse(
                type,
                error.message,
              )
              this.sendResponse(requestId, errorResponse)
            })
        } else {
          this.sendResponse(requestId, result)
        }
      }
    })
  }

  private createErrorResponse<T extends MessageType>(
    _type: T,
    errorMessage: string,
  ): MessageTypes[T]['response'] {
    // All functions follow the same error pattern: { error: string }
    return { error: errorMessage } as MessageTypes[T]['response']
  }

  private sendResponse(requestId: string, data: unknown) {
    const responseMessage: ResponseMessage = {
      type: '' as MessageType, // Not used for responses
      isResponse: true,
      requestId,
      data,
    }

    if (this.isUI) {
      parent.postMessage({ pluginMessage: responseMessage }, '*')
    } else {
      figma.ui.postMessage(responseMessage)
    }
  }

  private generateMessageId(): string {
    return `msg_${++this.messageIdCounter}_${Date.now()}`
  }

  // Send a message and wait for response
  async request<T extends keyof FunctionMessageTypes>(
    type: T,
    ...args: Parameters<FunctionMessageTypes[T]>
  ): Promise<MessageTypes[T]['response']> {
    return new Promise<MessageTypes[T]['response']>((resolve, reject) => {
      const id = this.generateMessageId()

      // Store the promise resolvers with type erasure for the map
      this.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
      })

      const message: BaseMessage = {
        type: type as MessageType,
        id,
        data: args,
      }

      // Send message
      if (this.isUI) {
        parent.postMessage({ pluginMessage: message }, '*')
      } else {
        figma.ui.postMessage(message)
      }

      // Set timeout for request
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id)
          reject(new Error(`Request timeout for message type: ${String(type)}`))
        }
      }, 10000) // 10 second timeout
    })
  }

  // Send a message without expecting a response
  notify<T extends MessageType>(type: T, data: MessageTypes[T]['data']): void {
    const message: BaseMessage = {
      type,
      data,
    }

    if (this.isUI) {
      parent.postMessage({ pluginMessage: message }, '*')
    } else {
      figma.ui.postMessage(message)
    }
  }

  // Listen for incoming messages
  on<T extends MessageType>(
    type: T,
    handler: MessageTypes[T] extends NotificationMessage<infer TData>
      ? (data: TData) => void
      : MessageTypes[T] extends FunctionToMessage<infer _TFunc>
        ? MessageTypes[T]['data'] extends readonly unknown[]
          ? (
              ...args: MessageTypes[T]['data']
            ) =>
              | MessageTypes[T]['response']
              | Promise<MessageTypes[T]['response']>
              | void
          : (
              data: MessageTypes[T]['data'],
            ) =>
              | MessageTypes[T]['response']
              | Promise<MessageTypes[T]['response']>
              | void
        : never,
  ): () => void {
    if (!this.messageListeners.has(type)) {
      this.messageListeners.set(type, [])
    }

    const listeners = this.messageListeners.get(type)!
    // Use type erasure for runtime storage
    listeners.push(handler as (data: unknown) => unknown)

    // Return unsubscribe function
    return () => {
      const index = listeners.indexOf(handler as (data: unknown) => unknown)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }

  // Remove all listeners for a message type
  off(type: MessageType): void {
    this.messageListeners.delete(type)
  }

  // Get context info
  getContext(): 'ui' | 'plugin' {
    return this.isUI ? 'ui' : 'plugin'
  }
}

// Export singleton instance
export const messenger = FigmaMessageHandler.getInstance()
