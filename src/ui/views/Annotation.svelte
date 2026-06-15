<script lang="ts">
  import { state as pluginState } from '@ui/store/state'
  import { errorStore } from '@ui/store/error'
  import selection, { selectionCount } from '@ui/store/selection'
  import Button from 'tint/components/Button.svelte'
  import SegmentedControl from 'tint/components/SegmentedControl.svelte'
  import Menu, { MENU_SEPARATOR } from 'tint/components/Menu.svelte'

  import GraphicGroupingEntire from '@ui/assets/grouping-entire.svg?raw'
  import GraphicGroupingIndividual from '@ui/assets/grouping-individual.svg?raw'
  import GraphicModeSame from '@ui/assets/mode-same.svg?raw'
  import GraphicModeSeparate from '@ui/assets/mode-separate.svg?raw'
  import GraphicPadding from '@ui/assets/padding.svg?raw'
  import IconBack from 'tint/icons/20-chevron-left.svg?raw'
  import IconMore from 'tint/icons/20-more.svg?raw'

  import type { AnnotationKind, LockState } from '@src/types'
  import AnnotationList from '../components/AnnotationList.svelte'
  import AnnotationTypeControl from '../components/AnnotationTypeControl.svelte'

  // Reference to AnnotationList for guard and selection
  let annotationListRef: AnnotationList | undefined = $state()

  // Annotation mode derived value
  let annotationMode = $derived($pluginState.annotationMode)

  // Selection grouping derived value
  let selectionGrouping = $derived($pluginState.selectionGrouping)

  // Current annotation type for theming buttons
  let currentAnnotationType = $derived($pluginState.annotationType)

  // When "Entire" is selected, show no selection and disable the control
  // The actual state is preserved and restored when switching back to "Individual"
  // Arrow type forces "Same" mode since arrows always join the spatially previous group
  let displayedAnnotationMode = $derived(
    selectionGrouping === 'entire'
      ? ''
      : currentAnnotationType === 'arrow'
        ? 'displace-group'
        : annotationMode,
  )
  let annotationModeDisabled = $derived(
    selectionGrouping === 'entire' || currentAnnotationType === 'arrow',
  )

  // Dynamic button label based on selection count and grouping mode
  let createButtonLabel = $derived.by(() => {
    if (selectionGrouping === 'individual' && $selectionCount > 1) {
      return `Create ${$selectionCount} annotations`
    }
    return 'Create annotation'
  })

  // Settings menu handler
  let settingsContextHandler: ((e: Event) => void) | undefined = $state()

  async function handleReturnToFrameSelection() {
    if (annotationListRef) {
      const canProceed = await annotationListRef.guardAndClearSelection()
      if (!canProceed) return
    }
    await errorStore.safeRequest('return-to-frame-selection')
  }

  async function handleSetLockState(state: LockState) {
    await errorStore.safeRequest('set-lock-state', state)
  }

  async function handleRegroupAnnotations() {
    await errorStore.safeRequest('regroup-annotations')
  }

  // Sync Figma canvas selection → UI annotation list selection
  $effect(() => {
    const refs = $selection.references
    if (refs.length === 0) {
      annotationListRef?.guardAndClearSelection()
      return
    }
    annotationListRef?.selectReferences(refs)
  })

  async function handleCreateAnnotation(padding: boolean) {
    // Guard against unsaved changes first
    if (annotationListRef) {
      const canProceed = await annotationListRef.guardAndClearSelection()
      if (!canProceed) return
    }

    const multi = $pluginState.selectionGrouping === 'individual'
    await errorStore.safeRequest('create-annotation', multi, padding)
  }
</script>

<div class="header">
  <div class="header-left">
    <Button
      small
      icon
      variant="ghost"
      aria-label="Return to frame selection"
      tooltip="Return to frame selection"
      onclick={handleReturnToFrameSelection}
    >
      {@html IconBack}
    </Button>
    <span class="header-title tint--type-ui-bold">
      {$pluginState.frames.annotationFrame?.name ?? ''}
    </span>
  </div>
  <Button
    small
    icon
    variant="ghost"
    aria-label="Settings"
    tooltip="Settings"
    onclick={settingsContextHandler}
  >
    {@html IconMore}
  </Button>
</div>

<div class="view">
  <div class="actions">
    <AnnotationTypeControl
      value={$pluginState.annotationType}
      onchange={(value: AnnotationKind) => {
        errorStore.safeRequest('set-annotation-type', value)
        const targetTab: 'navigation' | 'note' =
          value === 'tab' || value === 'arrow' ? 'navigation' : 'note'
        annotationListRef?.setTab(targetTab)
      }}
    />
    <div class="row">
      <div class="annotation-themed {currentAnnotationType}">
        <SegmentedControl
          id="selection-grouping-segmented"
          class="icon-segmented"
          label="Selection Grouping"
          items={[
            {
              value: 'entire',
              label: 'Entire',
              icon: GraphicGroupingEntire,
              tooltip: 'Annotate entire selection as one',
            },
            {
              value: 'individual',
              label: 'Individual',
              icon: GraphicGroupingIndividual,
              tooltip: 'Annotate each selected item separately',
            },
          ]}
          value={selectionGrouping}
          small
          onchange={(value: string) => {
            if (value) {
              errorStore.safeRequest(
                'set-selection-grouping',
                value as 'entire' | 'individual',
              )
            }
          }}
        />
      </div>
      <div class="annotation-themed {currentAnnotationType}">
        <SegmentedControl
          id="annotation-mode-segmented"
          class="icon-segmented"
          label="Annotation Mode"
          items={[
            {
              value: 'displace-group',
              label: 'Same',
              icon: GraphicModeSame,
              tooltip: 'Same reference for all selections',
            },
            {
              value: 'displace-multi',
              label: 'Separate',
              icon: GraphicModeSeparate,
              tooltip: 'Separate reference for each selection',
            },
          ]}
          value={displayedAnnotationMode}
          disabled={annotationModeDisabled}
          small
          onchange={(value: string) => {
            if (value) {
              errorStore.safeRequest(
                'set-annotation-mode',
                value as 'displace-group' | 'displace-multi',
              )
            }
          }}
        />
      </div>
    </div>
    <div class="row">
      <Button
        variant="primary"
        class="annotation-themed {currentAnnotationType}"
        disabled={$selectionCount < 1}
        onclick={() => handleCreateAnnotation(false)}
        aria-label={createButtonLabel}>{createButtonLabel}</Button
      >
      <Button
        variant="primary"
        icon
        class="annotation-themed {currentAnnotationType}"
        disabled={$selectionCount < 1}
        onclick={() => handleCreateAnnotation(true)}
        aria-label="Create annotation with padding"
        tooltip="With padding">{@html GraphicPadding}</Button
      >
    </div>
  </div>

  <hr class="divider" />

  <AnnotationList bind:this={annotationListRef} />
</div>

<Menu
  bind:contextClick={settingsContextHandler}
  variant="button"
  items={[
    {
      label: 'All layers unlocked',
      checked: () => $pluginState.lockState === 'all-unlocked',
      onClick: () => handleSetLockState('all-unlocked'),
    },
    {
      label: 'Design frame locked',
      checked: () => $pluginState.lockState === 'design-locked',
      onClick: () => handleSetLockState('design-locked'),
    },
    {
      label: 'Annotations locked',
      checked: () => $pluginState.lockState === 'annotations-locked',
      onClick: () => handleSetLockState('annotations-locked'),
    },
    MENU_SEPARATOR,
    {
      label: 'Regroup annotations',
      onClick: handleRegroupAnnotations,
    },
    {
      label: 'Help',
      onClick: () => errorStore.safeRequest('toggle-sidebar', 'help'),
    },
  ]}
/>

<style lang="sass">

.header
  display: flex
  align-items: center
  justify-content: space-between
  padding: tint.$size-12
  border-bottom: 1px solid var(--tint-card-border)

.header-left
  display: flex
  align-items: center
  gap: tint.$size-4
  min-width: 0

.header-title
  overflow: hidden
  text-overflow: ellipsis
  white-space: nowrap

.view
  display: flex
  box-sizing: border-box
  flex-direction: column
  padding: tint.$size-8
  gap: tint.$size-8
  flex: 1
  min-height: min-content

.actions
  display: flex
  flex-direction: column
  gap: tint.$size-8
  flex-shrink: 0

.row
  display: flex
  gap: tint.$size-8

  // Wrapper divs should fill available space
  > .annotation-themed
    flex: 1

  // Second row: first button takes remaining space
  &:last-child
    :global(> :first-child)
      flex: 1

:global(.icon-segmented .tint--button.small)
  padding: 0

</style>
