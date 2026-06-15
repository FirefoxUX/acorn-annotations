import type {
  AnnotationKind,
  BaseAnnotationRecord,
  FigmaAnnotationKind,
  SingleReference,
} from '@src/types'

/** Handles mapping between Figma annotation kinds and internal annotation kinds */
export class KindMapper {
  /** Maps Figma component kinds to internal annotation record kinds */
  static figmaToInternal(
    kind: FigmaAnnotationKind,
  ): BaseAnnotationRecord['kind'] {
    switch (kind) {
      case 'tabNavigation':
        return 'tab'
      case 'arrowKeyNavigation':
        return 'arrow'
      case 'note':
        return 'note'
      case 'component':
        return 'component-note'
      case 'presentational':
        return 'presentational'
      default:
        throw new Error(`Unknown annotation kind: ${kind}`)
    }
  }

  /** Maps internal annotation kinds to Figma component kinds */
  static internalToFigma(kind: AnnotationKind): FigmaAnnotationKind {
    switch (kind) {
      case 'tab':
        return 'tabNavigation'
      case 'arrow':
        return 'arrowKeyNavigation'
      case 'note':
        return 'note'
      case 'component-note':
        return 'component'
      case 'presentational':
        return 'presentational'
    }
  }

  /**
   * Maps internal kind to Figma kind for markers. Base mapping only. The
   * per-marker display (first marker of tab w/ compound ref = tab, rest =
   * arrow) is handled by ensureMarkerConsistency.
   */
  static internalToFigmaForMarker(
    kind: AnnotationKind,
    _reference?: SingleReference,
  ): FigmaAnnotationKind {
    return this.internalToFigma(kind)
  }

  /**
   * Maps Figma kind to internal kind. tabNavigation always maps to 'tab'
   * regardless of whether the reference is compound (e.g., "3A").
   * arrowKeyNavigation always maps to 'arrow'.
   */
  static figmaToInternalWithReference(
    kind: FigmaAnnotationKind,
    _reference: SingleReference,
  ): BaseAnnotationRecord['kind'] {
    return this.figmaToInternal(kind)
  }
}
