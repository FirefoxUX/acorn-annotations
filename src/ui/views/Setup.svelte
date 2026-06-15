<script lang="ts">
  import { state as pluginState } from '@ui/store/state'
  import { errorStore } from '@ui/store/error'
  import Button from 'tint/components/Button.svelte'
  import SegmentedControl from 'tint/components/SegmentedControl.svelte'
  import SceneNodePicker from '@ui/components/SceneNodePicker.svelte'
  import SetupHelpModal from '@ui/components/SetupHelpModal.svelte'
  import Header from '@ui/components/Header.svelte'
  import IconHelp from 'tint/icons/20-help.svg?raw'
  import IllustrationAnnotations from '@ui/assets/start-illustration/illustration-annotations.svg?raw'
  import IllustrationInfo from '@ui/assets/start-illustration/illustration-annotationinfo.svg?raw'
  import IconCheck from 'tint/icons/14-check.svg?raw'

  let splitInfoFrames = $derived(
    $pluginState.frames.annotationInfoFrame !== null &&
      typeof $pluginState.frames.annotationInfoFrame === 'object' &&
      'navigation' in $pluginState.frames.annotationInfoFrame,
  )

  let hasSavedGroups = $derived($pluginState.savedGroups.length > 0)

  let annotationSet = $derived($pluginState.frames.annotationFrame !== null)

  let infoSet = $derived.by(() => {
    const f = $pluginState.frames.annotationInfoFrame
    if (!f) return false
    if ('id' in f) return true
    return f.navigation !== null && f.notes !== null
  })

  let helpOpen: 'annotation' | 'info' | null = $state(null)

  function goBack() {
    errorStore.safeRequest('return-to-frame-selection')
  }
</script>

<Header
  title="Setup"
  onBack={hasSavedGroups ? goBack : undefined}
  backLabel="Back to saved configurations"
>
  {#snippet actions()}
    <Button
      small
      icon
      variant="ghost"
      toggled={$pluginState.sidebar === 'help'}
      aria-label="Open help"
      tooltip="Open help"
      onclick={() => errorStore.safeRequest('toggle-sidebar', 'help')}
    >
      {@html IconHelp}
    </Button>
  {/snippet}
</Header>

<div class="plugin-setup">
  <div class="illustration-row">
    <div
      class="illustration-card annotation"
      class:is-set={annotationSet}
      role="img"
      aria-label={annotationSet
        ? 'Annotation frame is set'
        : 'Annotation frame not set'}
    >
      <div class="illustration-label" aria-hidden="true">Annotation</div>
      <div class="illustration-frame">
        {@html IllustrationAnnotations}
        {#if annotationSet}
          <span class="check-badge" aria-hidden="true">{@html IconCheck}</span>
        {/if}
      </div>
    </div>
    <div
      class="illustration-card info"
      class:is-set={infoSet}
      role="img"
      aria-label={infoSet ? 'Info frame is set' : 'Info frame not set'}
    >
      <div class="illustration-label" aria-hidden="true">Info</div>
      <div class="illustration-frame">
        {@html IllustrationInfo}
        {#if infoSet}
          <span class="check-badge" aria-hidden="true">{@html IconCheck}</span>
        {/if}
      </div>
    </div>
  </div>

  <SegmentedControl
    id="select"
    label="Annotation mode"
    value={$pluginState.mode}
    items={[
      { value: 'desktop', label: 'Desktop' },
      { value: 'mobile', label: 'Mobile' },
    ]}
    onchange={(value) => {
      errorStore.safeRequest('set-mode', value as 'desktop' | 'mobile')
    }}
  />

  <SceneNodePicker
    id="picker1"
    label="Annotation frame"
    expects="annotation"
    value={$pluginState.frames.annotationFrame}
    onset={() => errorStore.safeRequest('set-frame', 'annotation')}
    onhelp={() => (helpOpen = 'annotation')}
  />

  {#if splitInfoFrames}
    <SceneNodePicker
      id="picker2"
      label="Navigation info frame"
      expects="info"
      value={typeof $pluginState.frames.annotationInfoFrame === 'object' &&
      $pluginState.frames.annotationInfoFrame !== null &&
      'navigation' in $pluginState.frames.annotationInfoFrame
        ? $pluginState.frames.annotationInfoFrame.navigation
        : null}
      onset={() => errorStore.safeRequest('set-frame', 'info-navigation')}
      onhelp={() => (helpOpen = 'info')}
    />
    <SceneNodePicker
      id="picker3"
      label="Notes info frame"
      expects="info"
      value={typeof $pluginState.frames.annotationInfoFrame === 'object' &&
      $pluginState.frames.annotationInfoFrame !== null &&
      'notes' in $pluginState.frames.annotationInfoFrame
        ? $pluginState.frames.annotationInfoFrame.notes
        : null}
      onset={() => errorStore.safeRequest('set-frame', 'info-notes')}
      onhelp={() => (helpOpen = 'info')}
    />
  {:else}
    <SceneNodePicker
      id="picker2"
      label="Annotation info frame"
      expects="info"
      value={typeof $pluginState.frames.annotationInfoFrame === 'object' &&
      $pluginState.frames.annotationInfoFrame !== null &&
      'id' in $pluginState.frames.annotationInfoFrame
        ? $pluginState.frames.annotationInfoFrame
        : null}
      onset={() => errorStore.safeRequest('set-frame', 'info')}
      onhelp={() => (helpOpen = 'info')}
    />
  {/if}

  <button
    type="button"
    class="link-toggle tint--type-ui"
    onclick={() => errorStore.safeRequest('create-info-frame')}
  >
    Create info frame
  </button>

  <button
    type="button"
    class="link-toggle tint--type-ui"
    disabled={$pluginState.mode === 'mobile'}
    onclick={() =>
      errorStore.safeRequest('set-split-info-frame', !splitInfoFrames)}
  >
    {splitInfoFrames ? 'Use single info frame' : 'Use separate info frames'}
  </button>
</div>
<div class="action">
  <Button
    onclick={() => errorStore.safeRequest('start-annotation')}
    variant="primary"
  >
    Start annotating
  </Button>
</div>

<SetupHelpModal kind={helpOpen} onclose={() => (helpOpen = null)} />

<style lang="sass">

.plugin-setup, .action
  display: flex
  flex-direction: column
  gap: tint.$size-12
  padding: tint.$size-12

.action
  gap: tint.$size-8

.plugin-setup
  flex: 1
  overflow-y: hidden

.link-toggle
  align-self: flex-start
  background: none
  border: none
  padding: 0
  color: var(--tint-action-primary)
  cursor: pointer
  text-decoration: underline
  &:disabled
    opacity: 0.5
    cursor: default

.illustration-row
  display: flex
  align-items: center
  justify-content: center
  gap: tint.$size-8
  padding-block: tint.$size-12

.illustration-card
  --illustration-text: var(--tint-text)
  --illustration-text-secondary: var(--tint-text-secondary)
  --illustration-accent: var(--color-tab)
  --illustration-box: var(--tint-input-bg)
  display: flex
  flex-direction: column
  gap: tint.$size-4
  &.is-set
    --illustration-text: var(--color-success-primary)
    --illustration-text-secondary: var(--color-success-primary)
    --illustration-accent: var(--color-success-primary)
    --illustration-box: var(--color-success-secondary)
  &.annotation
    flex: 0 1 auto
    min-width: 0
  &.info
    flex: 0 0 auto
  .illustration-label
    text-transform: uppercase
    font-weight: 700
    letter-spacing: 0.04em
    color: var(--illustration-accent)
    font-size: 14px
    line-height: 1
  .illustration-frame
    flex: 1
    position: relative
    display: flex
    align-items: center
    justify-content: center
    border: 1.5px dashed var(--illustration-accent)
    border-radius: tint.$size-8
    padding: tint.$size-12
    background: transparent
    :global(svg)
      display: block
      max-width: 100%
      height: auto

  .check-badge
    position: absolute
    top: 50%
    left: 50%
    transform: translate(-50%, -50%)
    display: inline-flex
    align-items: center
    justify-content: center
    width: 32px
    height: 32px
    border-radius: 50%
    background: var(--color-success-primary)
    color: #fff
    pointer-events: none
    border: 4px solid var(--tint-bg)
    :global(svg)
      display: block
      width: 14px
      height: 14px
</style>
