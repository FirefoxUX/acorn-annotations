import type {
  AnnotationKind,
  MultiReference,
  SingleReference,
} from '@src/types'
import { decodeReference, encodeReference } from '@src/shared-utils'
import { Reference } from './reference'

/** Utilities for handling annotation reference parsing, validation, and encoding */
export class ReferenceUtils {
  /**
   * Safely parses a string reference, returning null if parsing fails. Tries
   * the Reference class first, then falls back to legacy regex parsing for edge
   * cases like non-numeric/non-letter input.
   */
  static tryParseReference(reference: SingleReference): {
    referenceNumber: number
    subReference: number | null
    guessedKind: 'tab' | 'arrow' | 'note'
  } | null {
    // First try using the Reference class
    const parsed = Reference.parse(reference)
    if (parsed) {
      return {
        referenceNumber: parsed.referenceNumber,
        subReference: parsed.subReference,
        guessedKind: parsed.guessedKind,
      }
    }

    // Fall back to legacy parsing for edge cases
    const trimmed = reference.trim()
    if (trimmed) {
      if (this.parseComplexReference(trimmed).length > 0) {
        console.warn(
          'WARNING! You might have tried to parse a complex reference with tryParseReference',
          new Error().stack,
        )
      }

      // Try to extract a number from the string
      const match = trimmed.match(/(\d+)/)
      if (match) {
        const number = parseInt(match[1], 10)
        if (!isNaN(number)) {
          return {
            referenceNumber: number,
            subReference: null,
            guessedKind: 'tab',
          }
        }
      }

      // If it's a non-empty string without numbers, just use a hash code for consistent sorting
      let hashCode = 0
      for (let i = 0; i < trimmed.length; i++) {
        hashCode = (hashCode << 5) - hashCode + trimmed.charCodeAt(i)
        hashCode = hashCode & hashCode // Convert to 32bit integer
      }
      return {
        referenceNumber: Math.abs(hashCode),
        subReference: null,
        guessedKind: 'note',
      }
    }
    return null
  }

  /** Normalizes a reference string to uppercase and trimmed format */
  static normalizeReference(reference: SingleReference): SingleReference {
    return reference.trim().toUpperCase()
  }

  /** Encodes reference components into a string reference */
  static encodeReference(
    kind: AnnotationKind,
    reference: number,
    subReference: number | null,
  ): SingleReference {
    return encodeReference(kind, reference, subReference)
  }

  /** Compares two annotation references for sorting */
  static compareReferences(
    aRef: MultiReference,
    bRef: MultiReference,
    aKind?: AnnotationKind,
    bKind?: AnnotationKind,
  ): number {
    // First compare by navigation/non-navigation category if kinds are provided
    if (aKind !== undefined && bKind !== undefined) {
      const aNav = ReferenceUtils.isNavigationKind(aKind)
      const bNav = ReferenceUtils.isNavigationKind(bKind)
      if (aNav !== bNav) {
        const result = bNav ? 1 : -1
        return result
      }
    }

    // Try to parse the references for numeric comparison
    const aParsedArr = ReferenceUtils.parseComplexReference(aRef)
    const bParsedArr = ReferenceUtils.parseComplexReference(bRef)

    if (aParsedArr.length < 1 && bParsedArr.length < 1) {
      return 0
    }
    if (aParsedArr.length < 1 && !(bParsedArr.length < 1)) {
      return -1
    }
    if (!(aParsedArr.length < 1) && bParsedArr.length < 1) {
      return 1
    }

    // Try to parse the references for numeric comparison
    const aParsed = ReferenceUtils.tryParseReference(aParsedArr[0])
    const bParsed = ReferenceUtils.tryParseReference(bParsedArr[0])

    // If one reference is parseable and the other isn't, sort the parseable one first
    if (aParsed && !bParsed) {
      return -1
    }
    if (!aParsed && bParsed) {
      return 1
    }

    // If both are parseable, compare numerically
    if (aParsed && bParsed) {
      // Compare main reference numbers
      if (aParsed.referenceNumber !== bParsed.referenceNumber) {
        const result = aParsed.referenceNumber - bParsed.referenceNumber
        return result
      }

      // Compare sub references if present
      if (aParsed.subReference === null && bParsed.subReference !== null) {
        return -1
      }
      if (aParsed.subReference !== null && bParsed.subReference === null) {
        return 1
      }
      if (
        aParsed.subReference !== null &&
        bParsed.subReference !== null &&
        aParsed.subReference !== bParsed.subReference
      ) {
        const result = aParsed.subReference - bParsed.subReference
        return result
      }
      return 0
    }

    // Fallback to string comparison for unparseable references
    const result = aRef.localeCompare(bRef)
    return result
  }

  /** Determines if an annotation kind is navigation-related */
  static isNavigationKind(kind: AnnotationKind): boolean {
    return kind === 'tab' || kind === 'arrow'
  }

  static formatComplexReference(
    references: SingleReference[] | Set<SingleReference>,
  ): MultiReference {
    const referencesArr = Array.isArray(references)
      ? references
      : Array.from(references)

    if (!referencesArr.length) return ''
    if (referencesArr.length === 1) return referencesArr[0]

    const sortedRefs = [...referencesArr].sort(ReferenceUtils.compareReferences)
    const result: string[] = []

    let rangeStart: string | null = null
    let rangeEnd: string | null = null
    let currentKind: string | null = null
    let lastRefNum: number | null = null
    let lastSubRef: number | null = null

    for (let i = 0; i < sortedRefs.length; i++) {
      const current = sortedRefs[i]
      const parsed = ReferenceUtils.tryParseReference(current)

      if (!parsed) {
        // Handle unparseable reference
        if (rangeStart) {
          // Close any existing range
          result.push(
            rangeStart === rangeEnd ? rangeStart : `${rangeStart}-${rangeEnd}`,
          )
          rangeStart = rangeEnd = current
        } else {
          rangeStart = rangeEnd = current
        }
        currentKind = null
        lastRefNum = null
        lastSubRef = null
        continue
      }

      const { referenceNumber, subReference, guessedKind } = parsed

      // Check if this reference continues the current range
      const continuesRange =
        lastRefNum !== null &&
        ((referenceNumber === lastRefNum &&
          subReference === (lastSubRef !== null ? lastSubRef + 1 : 1)) ||
          (referenceNumber === lastRefNum + 1 &&
            subReference === null &&
            lastSubRef === null))

      if (!rangeStart || !continuesRange || currentKind !== guessedKind) {
        // Close any existing range
        if (rangeStart) {
          result.push(
            rangeStart === rangeEnd ? rangeStart : `${rangeStart}-${rangeEnd}`,
          )
        }
        // Start a new range
        rangeStart = rangeEnd = current
        currentKind = guessedKind
      } else {
        // Continue the current range
        rangeEnd = current
      }

      lastRefNum = referenceNumber
      lastSubRef = subReference
    }

    // Add the final range
    if (rangeStart) {
      result.push(
        rangeStart === rangeEnd ? rangeStart : `${rangeStart}-${rangeEnd}`,
      )
    }

    return result.join(', ')
  }

  /**
   * Parses a complex reference string into an array of individual references
   * Reverses the operation of formatComplexReference, converting ranges into
   * individual references
   */
  static parseComplexReference(reference: MultiReference): SingleReference[] {
    if (!reference.trim()) return []

    const parts = reference.split(',').map(this.normalizeReference)
    const result: SingleReference[] = []

    for (const part of parts) {
      if (part.includes('-')) {
        // Handle range
        const [start, end] = part.split('-').map((r) => r.trim())

        // Parse the start and end of the range
        let startParsed, endParsed
        try {
          startParsed = decodeReference(start)
          endParsed = decodeReference(end)
        } catch (_e) {
          startParsed = undefined
          endParsed = undefined
        }

        if (startParsed && endParsed) {
          // Both start and end are parseable
          if (startParsed.referenceNumber === endParsed.referenceNumber) {
            // Same reference number, different sub-references
            // e.g., 1A-1C
            if (
              startParsed.subReference !== null &&
              endParsed.subReference !== null
            ) {
              for (
                let sub = startParsed.subReference;
                sub <= endParsed.subReference;
                sub++
              ) {
                result.push(
                  ReferenceUtils.encodeReference(
                    startParsed.guessedKind,
                    startParsed.referenceNumber,
                    sub,
                  ),
                )
              }
            }
          } else if (
            startParsed.subReference === null &&
            endParsed.subReference === null
          ) {
            // Different reference numbers, no sub-references
            // e.g., 1-5
            for (
              let ref = startParsed.referenceNumber;
              ref <= endParsed.referenceNumber;
              ref++
            ) {
              result.push(
                ReferenceUtils.encodeReference(
                  startParsed.guessedKind,
                  ref,
                  null,
                ),
              )
            }
          } else {
            // Can't create a proper range, add the range as is
            result.push(start, end)
          }
        } else {
          // Non-parseable range, add as is
          result.push(part)
        }
      } else {
        // Single reference
        result.push(part)
      }
    }

    return result
  }
}
