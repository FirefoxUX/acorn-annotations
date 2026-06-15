import type { FigmaAnnotationKind, FigmaAnnotationType } from '@src/types'

/**
 * Default values for annotation properties This file contains shared defaults
 * used in both UI and code portions of the app
 */

// Mapping between idiomatic and Figma property values
export const FIGMA_KIND_MAP: Record<FigmaAnnotationKind, string> = {
  tabNavigation: 'Tab navigation',
  arrowKeyNavigation: 'Arrow key navigation',
  note: 'Note',
  presentational: 'Presentational',
  component: 'Component',
} as const

export const FIGMA_TYPE_MAP: Record<FigmaAnnotationType, string> = {
  area: 'Area',
  lineRight: 'Line right',
  lineLeft: 'Line left',
  lineTop: 'Line top',
  lineBottom: 'Line bottom',
} as const

// Reverse mappings
export const KIND_FROM_FIGMA = Object.fromEntries(
  Object.entries(FIGMA_KIND_MAP).map(([k, v]) => [v, k]),
) as Record<string, FigmaAnnotationKind>

export const TYPE_FROM_FIGMA = Object.fromEntries(
  Object.entries(FIGMA_TYPE_MAP).map(([k, v]) => [v, k]),
) as Record<string, FigmaAnnotationType>

// Default property values
export const DEFAULT_VALUES = {
  reference: '#',
  name: '[use on-screen string]',
  role: '---',
  note: '---',
  componentName: '[Component Name]',
  showComponentName: false,
  kind: 'tabNavigation' as FigmaAnnotationKind,
  type: 'area' as FigmaAnnotationType,
}

/** Component property keys used by Figma */
export const PROPERTY_KEYS = {
  reference: {
    annotation: 'Reference#15:0',
    info: 'Reference#14:2',
  },
  name: 'Name#585:0',
  role: 'Role#585:4',
  note: 'Note#585:8',
  componentName: 'Component name#3322:0',
  showComponentName: 'Show component name#3391:0',
  kind: 'Kind',
  type: 'Type',
}
