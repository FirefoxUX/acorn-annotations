/** Converts a number to its corresponding letter representation */
export function numberToLetters(num: number): string {
  // Enhanced input validation
  if (!Number.isInteger(num)) {
    // print input and print a new Error.trace
    throw new Error('Input must be an integer')
  }
  if (num < 1) {
    throw new Error('Number must be positive (>= 1)')
  }
  if (num > Number.MAX_SAFE_INTEGER) {
    throw new Error('Number exceeds safe integer limit')
  }

  // Use array for efficient string building instead of concatenation
  const letters: string[] = []
  let n = num

  while (n > 0) {
    n-- // Convert to 0-based indexing
    letters.unshift(String.fromCharCode(65 + (n % 26)))
    n = Math.floor(n / 26)
  }

  return letters.join('')
}

/** Converts a letter representation back to its corresponding number */
export function lettersToNumber(letters: string): number {
  // Input validation
  if (typeof letters !== 'string') {
    throw new Error('Input must be a string')
  }

  // Normalize to uppercase and trim
  const normalized = letters.trim().toUpperCase()

  if (normalized.length === 0) {
    throw new Error('Input cannot be empty')
  }

  if (!/^[A-Z]+$/.test(normalized)) {
    throw new Error('Input must contain only letters A-Z')
  }

  // Check for reasonable length to prevent overflow
  if (normalized.length > 7) {
    // Approximately log26(MAX_SAFE_INTEGER)
    throw new Error('Input too long - would exceed safe integer limit')
  }

  let result = 0

  for (let i = 0; i < normalized.length; i++) {
    const charValue = normalized.charCodeAt(i) - 64 // A=1, B=2, etc.
    result = result * 26 + charValue

    // Additional overflow check during calculation
    if (result > Number.MAX_SAFE_INTEGER) {
      throw new Error('Result exceeds safe integer limit')
    }
  }

  return result
}

import type { AnnotationKind } from './types'

export function decodeReference(reference: string): {
  referenceNumber: number
  subReference: number | null
  guessedKind: 'tab' | 'arrow' | 'note'
} {
  if (!reference) {
    throw new Error(`Empty reference provided`)
  }

  const ref = reference.trim().toUpperCase()
  if (ref === '') {
    throw new Error(`Empty reference after trimming`)
  }

  // Only numbers
  if (/^\d+$/.test(ref)) {
    const num = parseInt(ref, 10)
    return { referenceNumber: num, subReference: null, guessedKind: 'tab' }
  }

  // Only uppercase letters
  if (/^[A-Z]+$/.test(ref)) {
    try {
      const num = lettersToNumber(ref)
      return { referenceNumber: num, subReference: null, guessedKind: 'note' }
    } catch (error) {
      console.warn(`Invalid letter reference: ${reference}`)
      throw new Error(`Invalid letter reference: ${reference}`, {
        cause: error,
      })
    }
  }

  // Number followed by uppercase letters (common format for arrow annotations)
  const match = ref.match(/^(\d+)([A-Z]+)$/)
  if (match) {
    const baseNumber = parseInt(match[1], 10)
    const letters = match[2]
    try {
      const subRef = lettersToNumber(letters)
      return {
        referenceNumber: baseNumber,
        subReference: subRef,
        guessedKind: 'arrow',
      }
    } catch (error) {
      console.warn(`Invalid sub-reference letters: ${letters}`)
      throw new Error(`Invalid sub-reference letters: ${letters}`, {
        cause: error,
      })
    }
  }

  // If no numbers found, it's an invalid format
  console.warn(`Invalid reference format: ${reference}`)
  throw new Error(`Invalid reference format: ${reference}`)
}

export function encodeReference(
  kind: AnnotationKind,
  referenceNumber: number,
  subReference?: number | null,
): string {
  switch (kind) {
    case 'tab':
    case 'arrow':
      if (subReference === undefined || subReference === null) {
        return String(referenceNumber)
      }
      return `${referenceNumber}${numberToLetters(subReference)}`
    case 'note':
    case 'component-note':
    case 'presentational':
      return numberToLetters(referenceNumber)
    default:
      throw new Error(`Unknown annotation kind: ${kind}`)
  }
}

export function fastHash(str: string): number {
  let hash = 2166136261
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash *= 16777619
  }
  return hash >>> 0 // Convert to unsigned 32-bit
}
