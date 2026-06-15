import type { AnnotationKind, SingleReference } from '@src/types'
import { lettersToNumber, numberToLetters } from '@src/shared-utils'

/**
 * Immutable value object representing an annotation reference.
 *
 * References can be:
 *
 * - Numeric (tabs): "1", "2", "3"
 * - Letter (notes): "A", "B", "C"
 * - Combined (arrows): "1A", "1B", "2A"
 */
export class Reference {
  private constructor(
    /** The main reference number (1-based) */
    readonly referenceNumber: number,
    /** Sub-reference for arrow annotations (1-based), null for others */
    readonly subReference: number | null,
    /** The guessed kind based on the format */
    readonly guessedKind: 'tab' | 'arrow' | 'note',
  ) {
    Object.freeze(this)
  }

  /**
   * Parses a string reference into a Reference object. Returns null if the
   * reference cannot be parsed.
   */
  static parse(reference: SingleReference): Reference | null {
    if (!reference) return null

    const ref = reference.trim().toUpperCase()
    if (ref === '') return null

    try {
      // Only numbers → tab
      if (/^\d+$/.test(ref)) {
        const num = parseInt(ref, 10)
        return new Reference(num, null, 'tab')
      }

      // Only uppercase letters → note
      if (/^[A-Z]+$/.test(ref)) {
        const num = lettersToNumber(ref)
        return new Reference(num, null, 'note')
      }

      // Number followed by letters → arrow
      const match = ref.match(/^(\d+)([A-Z]+)$/)
      if (match) {
        const baseNumber = parseInt(match[1], 10)
        const subRef = lettersToNumber(match[2])
        return new Reference(baseNumber, subRef, 'arrow')
      }

      return null
    } catch {
      return null
    }
  }

  /** Creates a Reference for a specific kind with the given numbers. */
  static create(
    kind: AnnotationKind,
    referenceNumber: number,
    subReference: number | null = null,
  ): Reference {
    const guessedKind = Reference.kindToGuessedKind(kind)
    return new Reference(referenceNumber, subReference, guessedKind)
  }

  /** Encodes this reference as a string. */
  toString(): string {
    switch (this.guessedKind) {
      case 'tab':
        if (this.subReference === null) {
          return String(this.referenceNumber)
        }
        return `${this.referenceNumber}${numberToLetters(this.subReference)}`
      case 'arrow':
        if (this.subReference === null) {
          return String(this.referenceNumber)
        }
        return `${this.referenceNumber}${numberToLetters(this.subReference)}`
      case 'note':
        return numberToLetters(this.referenceNumber)
    }
  }

  /** Encodes the reference for a specific annotation kind. */
  encode(kind: AnnotationKind): string {
    switch (kind) {
      case 'tab':
      case 'arrow':
        if (this.subReference === null) {
          return String(this.referenceNumber)
        }
        return `${this.referenceNumber}${numberToLetters(this.subReference)}`
      case 'note':
      case 'component-note':
      case 'presentational':
        return numberToLetters(this.referenceNumber)
      default:
        throw new Error(`Unknown annotation kind: ${kind}`)
    }
  }

  /**
   * Compares this reference to another for sorting. Returns negative if this <
   * other, positive if this > other, 0 if equal.
   */
  compare(other: Reference): number {
    // Compare main reference numbers first
    if (this.referenceNumber !== other.referenceNumber) {
      return this.referenceNumber - other.referenceNumber
    }

    // Compare sub-references
    if (this.subReference === null && other.subReference !== null) {
      return -1
    }
    if (this.subReference !== null && other.subReference === null) {
      return 1
    }
    if (this.subReference !== null && other.subReference !== null) {
      return this.subReference - other.subReference
    }

    return 0
  }

  /** Creates a new Reference with the main reference number incremented. */
  increment(): Reference {
    return new Reference(
      this.referenceNumber + 1,
      this.subReference,
      this.guessedKind,
    )
  }

  /**
   * Creates a new Reference with the main reference number decremented. Returns
   * null if the result would be invalid (< 1).
   */
  decrement(): Reference | null {
    if (this.referenceNumber <= 1) return null
    return new Reference(
      this.referenceNumber - 1,
      this.subReference,
      this.guessedKind,
    )
  }

  /**
   * Creates a new Reference with the sub-reference incremented. If no
   * sub-reference exists, sets it to 1.
   */
  incrementSubReference(): Reference {
    const newSub = this.subReference === null ? 1 : this.subReference + 1
    return new Reference(this.referenceNumber, newSub, 'arrow')
  }

  /**
   * Creates a new Reference with the sub-reference decremented. Returns null if
   * the result would be invalid.
   */
  decrementSubReference(): Reference | null {
    if (this.subReference === null || this.subReference <= 1) return null
    return new Reference(
      this.referenceNumber,
      this.subReference - 1,
      this.guessedKind,
    )
  }

  /**
   * Returns true if this reference represents a navigation annotation
   * (tab/arrow).
   */
  get isNavigation(): boolean {
    return this.guessedKind === 'tab' || this.guessedKind === 'arrow'
  }

  /** Returns true if this reference represents a note annotation. */
  get isNote(): boolean {
    return this.guessedKind === 'note'
  }

  /** Returns true if this reference has a sub-reference (arrow type). */
  get hasSubReference(): boolean {
    return this.subReference !== null
  }

  /** Checks equality with another reference. */
  equals(other: Reference | null): boolean {
    if (other === null) return false
    return (
      this.referenceNumber === other.referenceNumber &&
      this.subReference === other.subReference &&
      this.guessedKind === other.guessedKind
    )
  }

  /** Converts an AnnotationKind to a guessed kind for Reference. */
  private static kindToGuessedKind(
    kind: AnnotationKind,
  ): 'tab' | 'arrow' | 'note' {
    switch (kind) {
      case 'tab':
        return 'tab'
      case 'arrow':
        return 'arrow'
      case 'note':
      case 'component-note':
      case 'presentational':
        return 'note'
    }
  }
}
