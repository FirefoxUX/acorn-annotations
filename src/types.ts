export type AnnotationKind =
  | 'tab'
  | 'arrow'
  | 'note'
  | 'component-note'
  | 'presentational'

// Figma component-property values for the annotation marker.
export type FigmaAnnotationKind =
  | 'tabNavigation'
  | 'arrowKeyNavigation'
  | 'note'
  | 'presentational'
  | 'component'

export type FigmaAnnotationType =
  | 'area'
  | 'lineRight'
  | 'lineLeft'
  | 'lineTop'
  | 'lineBottom'

export type MultiReference = string
export type SingleReference = string

// Core annotation data structure that encompasses all relevant information
export type BaseAnnotationRecord = {
  strReference: SingleReference
  annotationNodeId: string[]
  kind: AnnotationKind
}

export type TabArrowNoteFields = {
  name?: string
  role?: string
  note?: string
  componentName?: string
  showComponentName?: boolean
}

export type ComponentNoteFields = {
  name?: string
  note?: string
  componentName?: string
}

export type AnnotationRecord =
  | (BaseAnnotationRecord & { kind: 'tab' } & TabArrowNoteFields)
  | (BaseAnnotationRecord & { kind: 'arrow' } & TabArrowNoteFields)
  | (BaseAnnotationRecord & { kind: 'note' } & TabArrowNoteFields)
  | (BaseAnnotationRecord & { kind: 'component-note' } & ComponentNoteFields)
  | (BaseAnnotationRecord & { kind: 'presentational' })

export type MergedInfoGroup = {
  infoNodeId: string | null
  references: Set<SingleReference>
  hash: number
}

export type MergedInfoGroupSerialized = Omit<MergedInfoGroup, 'references'> & {
  references: SingleReference[]
}

export type SceneNodeReference = {
  type: string
  id: string
  name: string
}

export type ReferenceFrames = {
  annotationFrame: SceneNodeReference | null
  annotationInfoFrame:
    | SceneNodeReference
    | {
        navigation: SceneNodeReference | null
        notes: SceneNodeReference | null
      }
    | null
}

/** Saved frame group configuration persisted to page data */
export type SavedFrameGroup = {
  id: string
  name: string
  mode: 'desktop' | 'mobile'
  annotationFrameId: string
  annotationInfoFrameId: string | { navigation: string; notes: string }
  createdAt: number
}

/** Validated frame group with resolved frame info */
export type ValidatedFrameGroup = SavedFrameGroup & {
  isValid: boolean
  invalidReason?: 'deleted' | 'wrong-type' | 'wrong-page'
  annotationFrameName?: string
  infoFrameNames?: {
    single?: string
    navigation?: string
    notes?: string
  }
}

export type SelectedReferenceInfo = {
  reference: SingleReference
  kind: AnnotationKind
} | null

export type LockState =
  | 'all-unlocked' // Both annotations and design frame unlocked
  | 'design-locked' // Design frame locked, annotations unlocked
  | 'annotations-locked' // Annotations locked, design frame unlocked

export type PublicState = {
  view: 'loading' | 'setup' | 'saved-groups' | 'annotation'
  mode: 'desktop' | 'mobile'
  frames: ReferenceFrames
  annotationType: AnnotationKind
  annotationMode: 'displace-group' | 'displace-multi'
  selectionGrouping: 'entire' | 'individual'
  selectedReference: SelectedReferenceInfo
  sidebar: 'help' | 'debug' | null
  savedGroups: ValidatedFrameGroup[]
  lockState: LockState
}
