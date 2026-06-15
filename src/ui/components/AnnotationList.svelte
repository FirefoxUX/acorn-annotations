<script lang="ts">
  import { tick } from 'svelte'
  import { iconFromKind } from '../assets/annotation-icons'
  import { navigationAnnotations, noteAnnotations } from '../store/annotations'
  import SegmentedControl from 'tint/components/SegmentedControl.svelte'
  import Button from 'tint/components/Button.svelte'
  import Menu, {
    MENU_SEPARATOR,
    type MenuItem,
  } from 'tint/components/Menu.svelte'
  import { state as pluginState } from '@ui/store/state'
  import { selectionCount } from '@ui/store/selection'
  import IconTrash from 'tint/icons/20-trash.svg?raw'
  import IconMore from 'tint/icons/20-more.svg?raw'
  import IconAdd from 'tint/icons/20-add.svg?raw'
  import IconDragHandle from 'tint/icons/14-drag-handle.svg?raw'
  import IconSelect from 'tint/icons/20-select.svg?raw'
  import IconMerge from 'tint/icons/20-merge.svg?raw'

  import {
    reorderable,
    type ReorderableOptions,
  } from 'tint/actions/reorderable'
  import { errorStore } from '@ui/store/error'
  import type { AnnotationRecord } from '@src/types'
  import AnnotationEditPanel from './AnnotationEditPanel.svelte'
  import { SvelteSet } from 'svelte/reactivity'

  // Tab state
  let currentTab = $state(
    $pluginState.mode === 'desktop' ? 'navigation' : 'note',
  )

  // Selection state
  let selectedReferences = new SvelteSet<string>()
  let lastSelectedReference: string | null = $state(null)

  // Context menu handlers
  let itemContextHandler: ((e: Event) => void) | undefined = $state()
  let menuItems = $state<MenuItem[]>([])

  // Current tab's annotations
  const currentAnnotations = $derived(
    currentTab === 'navigation' ? $navigationAnnotations : $noteAnnotations,
  )

  // Selected annotations based on current selection
  const selectedAnnotations = $derived(
    currentAnnotations.filter((a) => selectedReferences.has(a.strReference)),
  )

  const tabItems = [
    $pluginState.mode === 'desktop' && {
      value: 'navigation',
      label: 'Nav',
    },
    {
      value: 'note',
      label: 'Note',
    },
  ].filter((item): item is SegmentedControl<string>['items'][number] => !!item)

  const reorderableOptions: ReorderableOptions = {
    handleSelector: '& > .handle',
    onreorder: ({ draggedElement, position, targetIndex }) => {
      const draggedRef = (draggedElement as HTMLElement).dataset.reference
      if (!draggedRef) return

      // Check if dragged item is in selection and selection has multiple items
      if (selectedReferences.has(draggedRef) && selectedReferences.size > 1) {
        // Get selected refs in their current order
        const selectedInOrder = currentAnnotations
          .filter((a) => selectedReferences.has(a.strReference))
          .map((a) => a.strReference)

        errorStore.safeRequest(
          'reorder-multiple-annotations-by-index',
          selectedInOrder,
          position,
          targetIndex as -1 | 0,
        )
      } else {
        // Single item reorder (existing behavior)
        errorStore.safeRequest(
          'reorder-annotation-by-index',
          draggedRef,
          position,
          targetIndex as -1 | 0,
        )
      }
    },
  }

  // Scroll to make a reference visible in the list
  function scrollToReference(ref: string) {
    const element = document.querySelector(`li[data-reference="${ref}"]`)
    element?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  // Replace selection with new refs without going through empty state
  // This prevents the slide transition from triggering on selection change
  function replaceSelection(newRefs: string[]) {
    // Add new refs first
    for (const ref of newRefs) {
      selectedReferences.add(ref)
    }
    // Then remove old refs that aren't in the new set
    const newSet = new Set(newRefs)
    for (const ref of [...selectedReferences]) {
      if (!newSet.has(ref)) {
        selectedReferences.delete(ref)
      }
    }
  }

  // Handle item click with modifier keys
  function handleItemClick(e: MouseEvent, annotation: AnnotationRecord) {
    const ref = annotation.strReference

    // Cmd/Ctrl + click: toggle in selection
    if (e.metaKey || e.ctrlKey) {
      if (selectedReferences.has(ref)) {
        selectedReferences.delete(ref)
      } else {
        selectedReferences.add(ref)
      }
      lastSelectedReference = ref
      return
    }

    // Shift + click: range select
    if (e.shiftKey && lastSelectedReference) {
      const lastIndex = currentAnnotations.findIndex(
        (a) => a.strReference === lastSelectedReference,
      )
      const currentIndex = currentAnnotations.findIndex(
        (a) => a.strReference === ref,
      )

      if (lastIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastIndex, currentIndex)
        const end = Math.max(lastIndex, currentIndex)

        // Add all items in range
        for (let i = start; i <= end; i++) {
          selectedReferences.add(currentAnnotations[i].strReference)
        }
      }
      return
    }

    // Regular click: select only this item
    // Skip if already the only selected item
    if (selectedReferences.size === 1 && selectedReferences.has(ref)) {
      return
    }

    replaceSelection([ref])
    lastSelectedReference = ref
  }

  // Handle tab change
  function handleTabChange(newTab: string) {
    if (currentTab === newTab) return
    currentTab = newTab
    selectedReferences.clear()
    lastSelectedReference = null
  }

  // Handle cancel/clear selection
  function handleClearSelection() {
    selectedReferences.clear()
    lastSelectedReference = null
  }

  // Handle kind category change (nav <-> note)
  async function handleKindCategoryChanged(
    newTab: 'navigation' | 'note',
    refs: string[],
  ) {
    // Switch to the appropriate tab
    currentTab = newTab
    // Update selection to match the new references
    replaceSelection(refs)
    if (refs.length > 0) {
      lastSelectedReference = refs[refs.length - 1]
      // Wait for DOM update then scroll to first selected item
      await tick()
      scrollToReference(refs[0])
    }
  }

  // Handle reference change (update selection with new reference)
  function handleReferenceChanged(oldRef: string, newRef: string) {
    if (selectedReferences.has(oldRef)) {
      selectedReferences.delete(oldRef)
      selectedReferences.add(newRef)
      if (lastSelectedReference === oldRef) {
        lastSelectedReference = newRef
      }
    }
  }

  // Handle Escape key
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && selectedReferences.size > 0) {
      const active = document.activeElement
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement
      ) {
        return
      }
      e.preventDefault()
      handleClearSelection()
    }
  }

  // Exposed methods for parent component
  export function guardAndClearSelection(): true {
    selectedReferences.clear()
    lastSelectedReference = null
    return true
  }

  export function setTab(tab: 'navigation' | 'note') {
    if (currentTab === tab) return
    currentTab = tab
    selectedReferences.clear()
    lastSelectedReference = null
  }

  export async function selectReferences(
    refs: string[],
    tab?: 'navigation' | 'note',
  ) {
    // Auto-infer tab from refs when caller didn't specify one (canvas-sync path).
    // Mixed selections leave tab undefined → don't switch.
    if (tab === undefined && refs.length > 0) {
      const inNav = refs.some((r) =>
        $navigationAnnotations.some((a) => a.strReference === r),
      )
      const inNote = refs.some((r) =>
        $noteAnnotations.some((a) => a.strReference === r),
      )
      if (inNav && !inNote) tab = 'navigation'
      else if (inNote && !inNav) tab = 'note'
    }

    // Get target annotations list
    const targetAnnotations =
      tab === 'navigation'
        ? $navigationAnnotations
        : tab === 'note'
          ? $noteAnnotations
          : currentAnnotations

    // Check if refs exist in the target list
    const refsExistInTarget = refs.some((ref) =>
      targetAnnotations.some((a) => a.strReference === ref),
    )

    // If refs don't exist yet, wait for them to appear
    if (!refsExistInTarget && refs.length > 0) {
      await tick()
    }

    // Add new refs first to prevent empty state
    for (const ref of refs) {
      selectedReferences.add(ref)
    }

    // Switch tab after adding refs
    if (tab) {
      currentTab = tab
    }

    // Wait for DOM update
    await tick()

    // Remove old refs that aren't in the new selection
    const newSet = new Set(refs)
    for (const ref of [...selectedReferences]) {
      if (!newSet.has(ref)) {
        selectedReferences.delete(ref)
      }
    }

    if (refs.length > 0) {
      lastSelectedReference = refs[refs.length - 1]
      scrollToReference(refs[0])
    }
  }

  // Context menu for individual items
  function openContextMenu(e: MouseEvent, annotation: AnnotationRecord) {
    const mergeableAnnotations = currentAnnotations.filter(
      (a) =>
        a.kind === annotation.kind &&
        a.strReference !== annotation.strReference,
    )

    const mergeMenuItems = [
      {
        label: 'Merge into',
        icon: IconMerge,
        disabled: mergeableAnnotations.length === 0,
        items: mergeableAnnotations.map((target) => ({
          label: `Annotation ${target.strReference}`,
          onClick: () =>
            handleMergeAnnotations(
              annotation.strReference,
              target.strReference,
            ),
        })),
      },
    ]

    menuItems = [
      {
        label: 'Delete',
        icon: IconTrash,
        onClick: () => handleDeleteAnnotation(annotation.strReference),
      },
      MENU_SEPARATOR as unknown as MenuItem,
      {
        label: 'Select markers',
        icon: IconSelect,
        onClick: () => handleSelectAnnotationMarkers(annotation.strReference),
      },
      ...mergeMenuItems,
      MENU_SEPARATOR as unknown as MenuItem,
      {
        label: 'Entire selection',
        icon: IconAdd,
        onClick: () =>
          errorStore.safeRequest(
            'add-to-annotation',
            annotation.strReference,
            false,
            false,
          ),
        disabled: $selectionCount < 1,
      },
      {
        label: 'Selection with padding',
        icon: IconAdd,
        onClick: () =>
          errorStore.safeRequest(
            'add-to-annotation',
            annotation.strReference,
            false,
            true,
          ),
        disabled: $selectionCount < 1,
      },
      {
        label: 'Individual selections',
        icon: IconAdd,
        onClick: () =>
          errorStore.safeRequest(
            'add-to-annotation',
            annotation.strReference,
            true,
            false,
          ),
        disabled: $selectionCount < 2,
      },
      {
        label: 'Individual with padding',
        icon: IconAdd,
        onClick: () =>
          errorStore.safeRequest(
            'add-to-annotation',
            annotation.strReference,
            true,
            true,
          ),
        disabled: $selectionCount < 2,
      },
    ]
    itemContextHandler?.(e)
  }

  // Handler functions
  async function handleDeleteAnnotation(strReference: string) {
    await errorStore.safeRequest('delete-annotation', strReference)
    // Remove from selection if deleted
    selectedReferences.delete(strReference)
  }

  async function handleSelectAnnotationMarkers(strReference: string) {
    await errorStore.safeRequest('select-annotation-markers', strReference)
  }

  async function handleMergeAnnotations(sourceRef: string, targetRef: string) {
    await errorStore.safeRequest('merge-annotation', sourceRef, targetRef)
  }

  // Delete all selected annotations
  async function handleDeleteSelected() {
    if (selectedReferences.size === 0) return
    const refs = [...selectedReferences]
    await errorStore.safeRequest('delete-multiple-annotations', refs)
    selectedReferences.clear()
    lastSelectedReference = null
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="annotation-list">
  <div class="controls">
    <SegmentedControl
      class="annotation-type"
      id="text-segmented"
      label="Choose view"
      items={tabItems}
      value={currentTab}
      small
      onchange={handleTabChange}
    />
    <Button
      onclick={handleDeleteSelected}
      disabled={selectedReferences.size === 0}
      small
      icon
      variant="ghost"
      aria-label="Delete selected"
      tooltip="Delete selected">{@html IconTrash}</Button
    >
  </div>

  <ol
    use:reorderable={reorderableOptions}
    role="listbox"
    aria-multiselectable="true"
    onclick={(e) => {
      // Deselect all when clicking empty space in the list
      if (e.target === e.currentTarget) {
        handleClearSelection()
      }
    }}
  >
    {#each currentAnnotations as annotation (annotation.strReference)}
      {@const annotationCount = annotation.annotationNodeId.length}
      {@const isSelected = selectedReferences.has(annotation.strReference)}
      <li
        data-reference={annotation.strReference}
        role="option"
        aria-selected={isSelected}
        class:selected={isSelected}
      >
        <div class="handle">
          {@html IconDragHandle}
        </div>
        <button
          class="selectable-area"
          onclick={(e) => handleItemClick(e, annotation)}
          type="button"
        >
          <div class="reference annotation-themed {annotation.kind}">
            <span>{@html iconFromKind[annotation.kind]}</span>
            <span>{annotation.strReference}</span>
          </div>
          <div class="info">
            <span class="tint--type-ui-small"
              >{annotationCount}
              {annotationCount === 1 ? 'item' : 'items'}</span
            >
          </div>
        </button>
        <div class="actions">
          <Button
            icon
            small
            variant="ghost"
            aria-label="More actions"
            tooltip="More actions"
            onclick={(e) => openContextMenu(e, annotation)}
            >{@html IconMore}</Button
          >
        </div>
      </li>
    {/each}
  </ol>

  <div class="edit-panel-anim" class:open={selectedAnnotations.length > 0}>
    <div class="edit-panel-anim__inner">
      {#if selectedAnnotations.length > 0}
        <div class="edit-panel-container">
          <AnnotationEditPanel
            {selectedAnnotations}
            mode={$pluginState.mode}
            onCancel={handleClearSelection}
            onKindCategoryChanged={handleKindCategoryChanged}
            onReferenceChanged={handleReferenceChanged}
          />
        </div>
      {/if}
    </div>
  </div>

  <Menu
    bind:contextClick={itemContextHandler}
    variant="button"
    items={menuItems}
  />
</div>

<style lang="sass">
.annotation-list
  flex-grow: 1
  flex-shrink: 1
  display: flex
  flex-direction: column
  min-height: min-content
  overflow: hidden

  .controls
    display: flex
    align-items: center
    gap: tint.$size-8
    padding-inline-end: tint.$size-4

  ol
    margin-block-start: tint.$size-8
    list-style: none
    overflow-y: auto
    flex: 1 1 0
    min-height: 64px
    border: 1px solid var(--tint-card-border)
    border-radius: tint.$size-12

  // Animation wrapper: grid-template-rows trick smoothly animates height
  // even though the inner panel has a min-height. When closed, the row
  // collapses to 0fr; open expands to 1fr (= the inner's natural size).
  .edit-panel-anim
    display: grid
    grid-template-rows: 0fr
    transition: grid-template-rows 200ms cubic-bezier(0.32, 0.72, 0, 1), margin-block-start 200ms cubic-bezier(0.32, 0.72, 0, 1)
    margin-block-start: 0
    flex: 0 1 auto
    max-height: 50vh

    &.open
      grid-template-rows: 1fr
      margin-block-start: tint.$size-8

  .edit-panel-anim__inner
    overflow: hidden
    min-height: 0
    display: flex
    flex-direction: column

  .edit-panel-container
    display: flex
    flex-direction: column
    flex: 1 1 0
    min-height: 350px

  .edit-panel-container:has(:global(.edit-panel.collapsed))
    flex: 0 0 auto
    min-height: 0

  li
    padding: tint.$size-4
    padding-inline-start: 0
    gap: 0
    display: flex
    align-items: center
    background-clip: padding-box
    &:has(.selectable-area:focus-visible)
      @include tint.effect-focus-base
      outline-offset: -2px
      border-radius: tint.$size-4
    &:not(:last-of-type)
      border-bottom: 1px solid var(--tint-card-border)

  .handle
    display: flex
    align-items: center
    justify-content: center
    width: tint.$size-32
    height: tint.$size-32
    color: var(--tint-text-secondary)
    font-weight: bold
    user-select: none
    line-height: 1
    flex-shrink: 0

  .selectable-area
    flex: 1
    display: flex
    align-items: center
    gap: tint.$size-4
    padding: tint.$size-4
    padding-inline-end: tint.$size-8
    background: none
    border: none
    border-radius: tint.$size-4
    cursor: pointer
    min-height: tint.$size-32
    text-align: left
    &:focus-visible
      outline: none
    &:hover
      background: var(--tint-action-secondary-hover)
    &:active
      background: var(--tint-action-secondary-active)

  .reference
    display: flex
    align-items: center
    color: var(--tint-action-secondary-text)
    gap: tint.$size-4

  .info
    flex: 1
    display: flex
    align-items: center
    justify-content: flex-end
    gap: tint.$size-8
    > span
      background: var(--tint-input-bg)
      color: var(--tint-text-secondary)
      padding: tint.$size-2 tint.$size-4
      border-radius: tint.$size-4

  .actions
    display: flex
    align-items: center
    flex-shrink: 0

  li.selected
    background-color: var(--tint-action-secondary-hover)
    .selectable-area:hover
      background: var(--tint-action-secondary-active)
    .info span
      background-color: transparent
</style>
