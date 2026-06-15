<script lang="ts">
  import { state as pluginState } from '@ui/store/state'
  import { errorStore } from '@ui/store/error'
  import Dialog, {
    type DialogOptions,
    type DialogResult,
  } from 'tint/components/Dialog.svelte'

  import Setup from '@ui/views/Setup.svelte'
  import SavedGroups from '@ui/views/SavedGroups.svelte'
  import Annotation from '@ui/views/Annotation.svelte'
  import DebugTable from '@ui/views/DebugTable.svelte'
  import Help from '@ui/views/Help.svelte'
  import LoadingIndicator from 'tint/components/LoadingIndicator.svelte'
  import ResizeHandle from '@ui/components/ResizeHandle.svelte'

  let openErrorDialog:
    | ((options?: DialogOptions) => Promise<DialogResult>)
    | undefined = $state(undefined)

  // Set up error dialog callback when openErrorDialog is available
  $effect(() => {
    if (openErrorDialog) {
      errorStore.setDialogCallback(async (options) => {
        await openErrorDialog?.({
          heading: options.heading,
          children: options.children,
        })
      })
    }
  })

  // Keydown event handler for keyboard shortcuts
  function handleKeydown(event: KeyboardEvent) {
    // Debug sidebar shortcut: Ctrl+Shift+D
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'd') {
      event.preventDefault()
      errorStore.safeRequest('toggle-sidebar', 'debug')
    }
    // Help sidebar shortcut: Ctrl+Shift+H
    else if (
      event.ctrlKey &&
      event.shiftKey &&
      event.key.toLowerCase() === 'h'
    ) {
      event.preventDefault()
      errorStore.safeRequest('toggle-sidebar', 'help')
    }
  }
</script>

<main>
  {#if $pluginState.view === 'loading'}
    <div class="loading">
      <LoadingIndicator />
    </div>
  {:else if $pluginState.view === 'setup'}
    <Setup />
  {:else if $pluginState.view === 'saved-groups'}
    <SavedGroups />
  {:else if $pluginState.view === 'annotation'}
    <Annotation />
  {/if}
</main>

{#if $pluginState.sidebar === 'help'}
  <section class="sidebar">
    <Help />
  </section>
{:else if $pluginState.sidebar === 'debug'}
  <section class="sidebar">
    <DebugTable />
  </section>
{/if}

<ResizeHandle />
<Dialog bind:openDialog={openErrorDialog} variant="acknowledge" />

<svelte:window on:keydown={handleKeydown} />

<style lang="sass">
main
  display: flex
  overflow-y: auto
  flex-direction: column
  flex: 1
  min-height: 0

.loading
  display: flex
  align-items: center
  justify-content: center
  flex: 1

.sidebar
  display: flex
  overflow: hidden
  flex-direction: column
  flex: 0 0 340px
  min-height: 0
  border-left: 1px solid var(--tint-card-border)
</style>
