<script lang="ts">
  import { selectionFrameKind } from '@ui/store/selection'
  import { messenger } from '@src/message-handler'
  import type { SceneNodeReference } from '@src/types'
  import Button from 'tint/components/Button.svelte'
  import { tooltip } from 'tint/actions/tooltip'
  import IconLocateMe from 'tint/icons/20-locate-me.svg?raw'
  import IconHelp from 'tint/icons/20-help.svg?raw'

  interface Props {
    id: string
    label: string
    expects: 'annotation' | 'info'
    value: SceneNodeReference | null
    onset?: (e: MouseEvent) => void
    onhelp?: (e: MouseEvent) => void
  }

  let {
    id,
    label,
    expects,
    value = $bindable(null),
    onset,
    onhelp,
  }: Props = $props()

  let isMatchingFrame = $derived($selectionFrameKind === expects)
  let pulse = $derived(isMatchingFrame && !value)
  let setTooltip = $derived(
    isMatchingFrame
      ? 'Set to selected frame'
      : expects === 'annotation'
        ? 'Select a frame without auto layout'
        : 'Select a frame with auto layout',
  )

  function focusFrame() {
    if (!value) return
    messenger
      .request('select-scene-node', value.id)
      .catch((err: unknown) => console.error('Failed to focus frame:', err))
  }
</script>

<div class="scene-node-picker" {id} role="group" aria-labelledby="{id}-label">
  <span id="{id}-label" class="tint--visually-hidden">{label}</span>
  <button
    type="button"
    class="frame-display"
    class:empty={!value}
    onclick={focusFrame}
    disabled={!value}
    aria-label={value
      ? `Focus ${label.toLowerCase()}: ${value.name}`
      : `${label}: no frame selected`}
    use:tooltip={value ? 'Focus this frame' : undefined}
  >
    <span class="label tint--type-input-small" aria-hidden="true">{label}</span>
    <span class="tint--type-input value" aria-hidden="true"
      >{value?.name ?? 'No frame selected'}</span
    >
  </button>

  <div class="set-button-wrap" class:pulse>
    <Button
      icon
      variant="primary"
      aria-label="Set {label.toLowerCase()} to selected frame"
      tooltip={setTooltip}
      onclick={onset}
    >
      {@html IconLocateMe}
    </Button>
  </div>

  <Button
    icon
    variant="ghost"
    aria-label="What is {label.toLowerCase()}?"
    tooltip="What is this?"
    onclick={onhelp}
  >
    {@html IconHelp}
  </Button>
</div>

<style lang="sass">
.scene-node-picker
  display: flex
  align-items: stretch
  gap: 0
  padding: tint.$size-8
  background-color: var(--tint-input-bg)
  border-radius: 20px

.frame-display
  flex: 1
  min-width: 0
  display: flex
  flex-direction: column
  align-items: flex-start
  justify-content: center
  gap: tint.$size-2
  text-align: left
  background-color: transparent
  border: 2px solid transparent
  border-radius: 12px
  color: var(--tint-text)
  min-height: 48px
  padding: 6px 12px
  font: inherit
  cursor: pointer
  &:not(:disabled):hover
    background-color: var(--tint-action-secondary-hover)
  &:not(:disabled):active
    background-color: var(--tint-action-secondary-active)
  &:focus-visible
    outline: 2px solid var(--tint-action-primary)
    outline-offset: 2px
  &:disabled
    cursor: default
  .label
    color: var(--tint-text-secondary)
    line-height: 1
  .value
    color: var(--tint-text)
    line-height: 1.2
    max-width: 100%
    white-space: nowrap
    overflow: hidden
    text-overflow: ellipsis
  &.empty .value
    color: var(--tint-text-secondary)

.set-button-wrap
  position: relative
  display: inline-flex
  border-radius: 12px
  &.pulse::before
    content: ''
    position: absolute
    inset: 0
    border-radius: inherit
    background-color: var(--tint-action-primary)
    animation: scene-node-picker-pulse 1.6s ease-out infinite
    pointer-events: none
    z-index: 0
  :global(.tint--button)
    position: relative
    z-index: 1

@keyframes scene-node-picker-pulse
  0%
    transform: scale(1)
    opacity: 0.5
  100%
    transform: scale(1.35)
    opacity: 0

@media (prefers-reduced-motion: reduce)
  .set-button-wrap.pulse::before
    animation: none
    opacity: 0
</style>
