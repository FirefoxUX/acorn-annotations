<script lang="ts">
  import { state as pluginState } from '@ui/store/state'
  import SegmentedControl from 'tint/components/SegmentedControl.svelte'
  import AnnoIcons from '@ui/assets/annotation-icons'
  import IconMixed from 'tint/icons/20-more.svg?raw'
  import type { AnnotationKind } from '@src/types'

  // Props for the component
  interface Props {
    value?: AnnotationKind | 'mixed'
    onchange?: (value: AnnotationKind) => void
    showMixed?: boolean
    small?: boolean
  }

  let {
    value = $bindable(undefined),
    onchange,
    showMixed = false,
    small = $bindable(true),
  }: Props = $props()

  // Build annotation type items dynamically based on mode and showMixed
  const annotationTypeItems = $derived(
    [
      showMixed && {
        value: 'mixed',
        class: 'annotation-themed mixed',
        'aria-label': 'Mixed types',
        tooltip: 'Mixed types',
        icon: IconMixed,
      },
      $pluginState.mode === 'desktop' && {
        value: 'tab',
        class: 'annotation-themed tab',
        'aria-label': 'Tab navigation',
        tooltip: 'Tab navigation',
        icon: AnnoIcons.tab,
      },
      $pluginState.mode === 'desktop' && {
        value: 'arrow',
        class: 'annotation-themed arrow',
        'aria-label': 'Arrow key navigation',
        tooltip: 'Arrow key navigation',
        icon: AnnoIcons.arrow,
      },
      {
        value: 'note',
        class: 'annotation-themed note',
        'aria-label': 'Note',
        tooltip: 'Note',
        icon: AnnoIcons.note,
      },
      {
        value: 'component-note',
        class: 'annotation-themed component-note',
        'aria-label': 'Component (note)',
        tooltip: 'Component (note)',
        icon: AnnoIcons.noteComponent,
      },
      {
        value: 'presentational',
        class: 'annotation-themed presentational',
        'aria-label': 'Presentational',
        tooltip: 'Presentational',
        icon: AnnoIcons.presentational,
      },
    ].filter(
      (item): item is SegmentedControl<string>['items'][number] => !!item,
    ),
  )

  // Handle the change event and propagate it upwards
  function handleChange(newValue: string) {
    // Don't allow selecting 'mixed' - it's display only
    if (newValue && newValue !== 'mixed' && onchange) {
      onchange(newValue as AnnotationKind)
    }
  }
</script>

<SegmentedControl
  class="annotation-type"
  id="annotation-type-control"
  label="Choose an option"
  items={annotationTypeItems}
  {value}
  {small}
  onchange={handleChange}
/>

<style lang="sass">
  // Add any specific styles here if needed
</style>
