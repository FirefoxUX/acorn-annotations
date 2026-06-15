<script lang="ts">
  import type { AnnotationKind, AnnotationRecord } from '@src/types'
  import { errorStore } from '@ui/store/error'
  import Button from 'tint/components/Button.svelte'
  import TextField from 'tint/components/TextField.svelte'
  import Select from 'tint/components/Select.svelte'
  import Autocomplete from 'tint/components/Autocomplete.svelte'
  import LabeledToggleable from 'tint/components/LabeledToggleable.svelte'
  import { DEFAULT_VALUES } from '@src/shared-annotation-defaults'
  import {
    toDisplayName,
    toTechnicalName,
    getAutocompleteItems,
  } from '@src/component-map'
  import { getRoleItems, isKnownRole } from '@src/role-options'
  import {
    decodeReference,
    numberToLetters,
    lettersToNumber,
  } from '@src/shared-utils'
  import AnnotationTypeControl from './AnnotationTypeControl.svelte'
  import IconClose from 'tint/icons/20-close.svg?raw'
  import IconChevronDown from 'tint/icons/20-chevron-down.svg?raw'
  import IconChevronUp from 'tint/icons/20-chevron-up.svg?raw'

  interface Props {
    selectedAnnotations: AnnotationRecord[]
    mode: 'desktop' | 'mobile'
    onCancel?: () => void
    onKindCategoryChanged?: (
      newTab: 'navigation' | 'note',
      refs: string[],
    ) => void
    onReferenceChanged?: (oldRef: string, newRef: string) => void
  }

  // Helper to check if a kind is navigation type
  function isNavigationKind(k: AnnotationKind | 'mixed' | undefined): boolean {
    return k === 'tab' || k === 'arrow'
  }

  // Returns the correctly typed value for the specified key
  function getField<
    K extends 'name' | 'role' | 'note' | 'componentName' | 'showComponentName',
  >(a: AnnotationRecord | null, key: K): (typeof DEFAULT_VALUES)[K] {
    if (a && key in a && a[key as never] !== undefined)
      return a[key as never] as (typeof DEFAULT_VALUES)[K]
    return DEFAULT_VALUES[key]
  }

  let {
    selectedAnnotations,
    mode,
    onCancel,
    onKindCategoryChanged,
    onReferenceChanged,
  }: Props = $props()

  // Build role dropdown items, prepending any custom existing value
  const roleItems = $derived.by(() => {
    const items = getRoleItems(mode)
    if (role && role !== '---' && !isKnownRole(role, mode)) {
      return [{ value: role, label: `${role} (custom)` }, ...items]
    }
    return items
  })

  // Check if we're in multi-edit mode
  const isMultiEdit = $derived(selectedAnnotations.length > 1)

  // Use the first annotation as the template
  const templateAnnotation = $derived(
    selectedAnnotations.length > 0 ? selectedAnnotations[0] : null,
  )

  // Check if selection has mixed kinds
  const isMixedKind = $derived(
    new Set(selectedAnnotations.map((a) => a.kind)).size > 1,
  )

  // Detect if all selected annotations have compound references (number+letter)
  const allCompoundRefs = $derived(
    selectedAnnotations.length > 0 &&
      selectedAnnotations.every((a) => {
        try {
          const parsed = decodeReference(a.strReference)
          return parsed.subReference !== null
        } catch {
          return false
        }
      }),
  )

  // Form fields - initialize from template
  let strReference = $state('')
  let refNumber = $state('')
  let refLetter = $state('')
  let kind = $state<AnnotationKind | 'mixed'>('note')
  let name = $state('')
  let role = $state('')
  let note = $state('')
  let componentName = $state('')
  let showComponentName = $state(false)

  // Compact-viewport collapse/expand state
  let windowHeight = $state(0)
  const isCompact = $derived(windowHeight > 0 && windowHeight < 850)
  let expanded = $state(false)

  // Version counter to discard stale commits after selection changes
  let commitVersion = 0

  // Commit queue to serialize rapid sequential commits
  let commitQueue = Promise.resolve()

  // Reset form when selection changes
  $effect(() => {
    if (selectedAnnotations.length > 0) {
      strReference = selectedAnnotations.map((a) => a.strReference).join(', ')
      kind = isMixedKind ? 'mixed' : (templateAnnotation?.kind ?? 'note')
      name = getField(templateAnnotation, 'name')
      role = getField(templateAnnotation, 'role')
      note = getField(templateAnnotation, 'note')
      showComponentName = getField(templateAnnotation, 'showComponentName')

      // Populate split reference fields for compound refs
      if (allCompoundRefs) {
        try {
          const firstParsed = decodeReference(
            selectedAnnotations[0].strReference,
          )
          refNumber = String(firstParsed.referenceNumber)

          // Check if all selected have the same letter
          const letters = selectedAnnotations.map((a) => {
            try {
              return decodeReference(a.strReference).subReference
            } catch {
              return null
            }
          })
          const allSameLetter = letters.every((l) => l === letters[0])
          refLetter =
            allSameLetter && letters[0] !== null
              ? numberToLetters(letters[0])
              : ''
        } catch {
          refNumber = ''
          refLetter = ''
        }
      }

      // Convert technical → display name for the component name field
      componentName = toDisplayName(
        getField(templateAnnotation, 'componentName'),
      )

      // Bump version to invalidate any in-flight commits
      commitVersion++
    }
  })

  const componentItems = $derived(getAutocompleteItems(mode))

  // Build an AnnotationRecord from current field state
  function buildAnnotationRecord(): AnnotationRecord {
    const baseUpdate = {
      strReference: templateAnnotation?.strReference || '',
      annotationNodeId: templateAnnotation
        ? Array.from(templateAnnotation.annotationNodeId)
        : [],
    }

    const effectiveKind =
      kind === 'mixed' ? (templateAnnotation?.kind ?? 'note') : kind

    const technicalComponentName = toTechnicalName(componentName, mode)

    switch (effectiveKind) {
      case 'tab':
      case 'arrow':
        return {
          ...baseUpdate,
          kind: effectiveKind,
          name: name || undefined,
          role: role || undefined,
          note: note || undefined,
          componentName: showComponentName
            ? technicalComponentName || undefined
            : undefined,
          showComponentName: showComponentName,
        } as AnnotationRecord
      case 'note':
        return {
          ...baseUpdate,
          kind: 'note',
          name: name || undefined,
          role: role || undefined,
          note: note || undefined,
        } as AnnotationRecord
      case 'component-note':
        return {
          ...baseUpdate,
          kind: 'component-note',
          name: name || undefined,
          note: note || undefined,
          componentName: technicalComponentName || undefined,
        } as AnnotationRecord
      case 'presentational':
        return {
          ...baseUpdate,
          kind: 'presentational',
        } as AnnotationRecord
      default:
        return {
          ...baseUpdate,
          kind: 'note',
          name: name || undefined,
          role: role || undefined,
          note: note || undefined,
        } as AnnotationRecord
    }
  }

  // Commit current field state to the plugin
  function commitField() {
    const version = commitVersion
    commitQueue = commitQueue.then(async () => {
      if (version !== commitVersion) return
      if (selectedAnnotations.length === 0) return

      const updatedAnnotation = buildAnnotationRecord()
      const annotationRefs = selectedAnnotations.map((a) => a.strReference)
      const originalRef = annotationRefs[0]

      const result = await errorStore.safeRequest(
        'update-multiple-annotations',
        annotationRefs,
        updatedAnnotation,
        undefined,
      )

      if (version !== commitVersion) return

      if (result && !('error' in result)) {
        const effectiveKind =
          kind === 'mixed' ? (templateAnnotation?.kind ?? 'note') : kind
        const originalKind = isMixedKind
          ? templateAnnotation?.kind
          : (templateAnnotation?.kind ?? 'note')
        const wasNavigation = isNavigationKind(originalKind)
        const isNavigation = isNavigationKind(effectiveKind)

        // If the plugin renamed the reference (kind transition across boundary,
        // or tab↔arrow within navigation), propagate that to the parent's
        // selection state BEFORE any tab switch — otherwise the tab-switch
        // would replaceSelection with a now-stale ref.
        const renamed =
          'newReference' in result && result.newReference
            ? result.newReference
            : undefined
        if (renamed && renamed !== originalRef) {
          onReferenceChanged?.(originalRef, renamed)
        }

        if (wasNavigation !== isNavigation) {
          const newTab = isNavigation ? 'navigation' : 'note'
          const refs = [renamed ?? originalRef]
          onKindCategoryChanged?.(newTab, refs)
        }
      }
    })
  }

  // Commit reference field (handles displacement)
  function commitReference() {
    if (isMultiEdit) return
    const originalRef = templateAnnotation?.strReference ?? ''
    if (strReference === originalRef) return

    const version = commitVersion
    const capturedNewRef = strReference
    commitQueue = commitQueue.then(async () => {
      if (version !== commitVersion) return
      if (selectedAnnotations.length === 0) return

      const updatedAnnotation = buildAnnotationRecord()
      const annotationRefs = selectedAnnotations.map((a) => a.strReference)

      const result = await errorStore.safeRequest(
        'update-multiple-annotations',
        annotationRefs,
        updatedAnnotation,
        capturedNewRef,
      )

      if (version !== commitVersion) return

      if (result && !('error' in result)) {
        onReferenceChanged?.(originalRef, capturedNewRef)

        const effectiveKind =
          kind === 'mixed' ? (templateAnnotation?.kind ?? 'note') : kind
        const originalKind = isMixedKind
          ? templateAnnotation?.kind
          : (templateAnnotation?.kind ?? 'note')
        const wasNavigation = isNavigationKind(originalKind)
        const isNavigation = isNavigationKind(effectiveKind)

        if (wasNavigation !== isNavigation) {
          const newTab = isNavigation ? 'navigation' : 'note'
          onKindCategoryChanged?.(newTab, [capturedNewRef])
        }
      }
    })
  }

  // Commit compound reference change (number or letter part)
  function commitCompoundReference(part: 'number' | 'letter') {
    if (part === 'number' && isMultiEdit) return // Number disabled in multi-edit

    const version = commitVersion
    commitQueue = commitQueue.then(async () => {
      if (version !== commitVersion) return
      if (selectedAnnotations.length === 0) return

      if (part === 'letter') {
        const normalizedLetter = refLetter.trim().toUpperCase()
        if (!normalizedLetter) return

        let letterNum: number
        try {
          letterNum = lettersToNumber(normalizedLetter)
        } catch {
          return // Invalid letter
        }

        // Update letter for ALL selected annotations
        for (const annotation of selectedAnnotations) {
          try {
            const parsed = decodeReference(annotation.strReference)
            if (parsed.subReference === letterNum) continue // No change
            const newRef = `${parsed.referenceNumber}${normalizedLetter}`
            const updatedAnnotation = buildAnnotationRecord()
            await errorStore.safeRequest(
              'update-multiple-annotations',
              [annotation.strReference],
              updatedAnnotation,
              newRef,
            )
          } catch {
            // Skip invalid references
          }
        }
      } else {
        // Update number for single annotation
        if (selectedAnnotations.length !== 1) return
        const annotation = selectedAnnotations[0]
        const newNumber = parseInt(refNumber, 10)
        if (isNaN(newNumber) || newNumber < 1) return

        try {
          const parsed = decodeReference(annotation.strReference)
          if (parsed.referenceNumber === newNumber) return // No change
          const letterPart =
            parsed.subReference !== null
              ? numberToLetters(parsed.subReference)
              : 'A'
          const newRef = `${newNumber}${letterPart}`
          const updatedAnnotation = buildAnnotationRecord()
          await errorStore.safeRequest(
            'update-multiple-annotations',
            [annotation.strReference],
            updatedAnnotation,
            newRef,
          )

          if (version !== commitVersion) return
          onReferenceChanged?.(annotation.strReference, newRef)
        } catch {
          // Invalid reference
        }
      }
    })
  }

  // The kind to display in the form
  const displayKind = $derived(kind === 'mixed' ? 'note' : kind)
</script>

<svelte:window bind:innerHeight={windowHeight} />

<div class="edit-panel" class:collapsed={isCompact && !expanded}>
  <div class="edit-header">
    <h3 class="tint--type-body-sans-bold">
      {#if isMultiEdit}
        Edit {selectedAnnotations.length} items
      {:else}
        Edit annotation
      {/if}
    </h3>
    <div class="edit-header-actions">
      {#if isCompact}
        <Button
          variant="secondary"
          onclick={() => (expanded = !expanded)}
          small
          icon
          type="button"
          tooltip={expanded ? 'Collapse' : 'Expand'}
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {@html expanded ? IconChevronUp : IconChevronDown}
        </Button>
      {/if}
      <Button
        variant="secondary"
        onclick={onCancel}
        small
        icon
        type="button"
        tooltip="Close"
        aria-label="Close"
      >
        {@html IconClose}
      </Button>
    </div>
  </div>

  {#if !isCompact || expanded}
    <div class="edit-form">
      {#if allCompoundRefs}
        <div class="field compound-ref">
          <TextField
            id="reference-number"
            label="Reference"
            bind:value={refNumber}
            disabled={isMultiEdit}
            oncommit={() => commitCompoundReference('number')}
          />
          <TextField
            id="reference-letter"
            label="Sub-reference"
            bind:value={refLetter}
            oncommit={() => commitCompoundReference('letter')}
          />
        </div>
      {:else}
        <div class="field">
          <TextField
            id="reference"
            label="Reference"
            bind:value={strReference}
            disabled={isMultiEdit}
            oncommit={() => commitReference()}
          />
        </div>
      {/if}

      <div class="field">
        <AnnotationTypeControl
          value={kind}
          onchange={(newKind) => {
            kind = newKind
            commitField()
          }}
          showMixed={isMixedKind}
          small
        />
      </div>

      {#if displayKind === 'tab' || displayKind === 'arrow' || displayKind === 'note'}
        <div class="field">
          <TextField
            id="name"
            label="Name"
            bind:value={name}
            oncommit={() => commitField()}
          />
        </div>

        <div class="field">
          <Select
            id="role"
            label="Role"
            bind:value={role}
            items={roleItems}
            onchange={() => commitField()}
          />
        </div>

        {#if displayKind === 'arrow' || displayKind === 'tab'}
          <div class="field toggle">
            <LabeledToggleable
              bind:checked={showComponentName}
              id="show-component-name"
              type="switch"
              label="Show Component Name"
              onchange={() => commitField()}
            />
          </div>

          {#if showComponentName}
            <div class="field" onfocusout={() => commitField()}>
              <Autocomplete
                bind:value={componentName}
                allowFreeText
                id="component-name"
                label="Component Name"
                items={componentItems}
              />
            </div>
          {/if}
        {/if}

        <div class="field">
          <TextField
            id="note"
            label="Note"
            variant="textarea"
            rows={3}
            bind:value={note}
            oncommit={() => commitField()}
          />
        </div>
      {:else if displayKind === 'component-note'}
        <div class="field" onfocusout={() => commitField()}>
          <Autocomplete
            bind:value={componentName}
            allowFreeText
            id="component-name"
            label="Component Name"
            items={componentItems}
          />
        </div>

        <div class="field">
          <TextField
            id="name"
            label="Name"
            bind:value={name}
            oncommit={() => commitField()}
          />
        </div>

        <div class="field">
          <TextField
            id="note"
            label="Note"
            bind:value={note}
            variant="textarea"
            rows={5}
            oncommit={() => commitField()}
          />
        </div>
      {/if}
    </div>
  {/if}
</div>

<style lang="sass">
.edit-panel
  display: flex
  flex-direction: column
  background: var(--tint-bg)
  min-height: 0
  overflow-y: auto
  flex: 1 1 0
  border: 1px solid var(--tint-card-border)
  border-radius: tint.$size-12

.edit-panel.collapsed
  flex: 0 0 auto
  overflow: hidden
  .edit-header
    border-bottom: none

.edit-header
  position: sticky
  top: 0
  background: var(--tint-bg)
  z-index: 1
  padding: tint.$size-12
  border-bottom: 1px solid var(--tint-card-border)
  display: flex
  align-items: center
  gap: tint.$size-8
  h3
    margin: 0

.edit-header-actions
  display: flex
  gap: tint.$size-4
  margin-left: auto

.edit-form
  display: flex
  flex-direction: column
  gap: tint.$size-8
  padding: tint.$size-12

.field
  width: 100%

.field.toggle
  margin-top: tint.$size-4

.compound-ref
  display: flex
  gap: tint.$size-8
  > :global(:first-child)
    flex: 1
  > :global(:last-child)
    flex: 1
</style>
