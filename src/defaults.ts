import type { PublicState } from './types'

export const ANNOTATION_COMPONENT_KEY =
  '54701a3875b6957caddf8c9366ad8645de5f4edd'
export const ANNOTATION_COMPONENT_INFO_KEY =
  'f913515856a7cc22710273b0dc817bcf0c862004'

/**
 * Default state shared between UI and code contexts This ensures both sides
 * start with the same initial state
 */
export const DEFAULT_STATE: PublicState = {
  view: 'loading',
  mode: 'desktop',
  annotationType: 'tab',
  annotationMode: 'displace-multi',
  selectionGrouping: 'entire',
  selectedReference: null,
  sidebar: null,
  frames: {
    annotationFrame: null,
    annotationInfoFrame: null,
  },
  savedGroups: [],
  lockState: 'all-unlocked',
} as const

// Window sizing
export const SIDEBAR_WIDTH = 340
export const MIN_MAIN_WIDTH = 300
export const MAX_MAIN_WIDTH = 550
export const MIN_HEIGHT = 200
export const DEFAULT_MAIN_WIDTH = 340
export const DEFAULT_HEIGHT = 1000
