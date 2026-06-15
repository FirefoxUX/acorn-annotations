<script lang="ts">
  import { state as pluginState } from '@ui/store/state'
  import { errorStore } from '@ui/store/error'
  import Button from 'tint/components/Button.svelte'
  import MessageBox from 'tint/components/MessageBox.svelte'
  import Header from '@ui/components/Header.svelte'
  import IconTrash from 'tint/icons/20-trash.svg?raw'
  import IconCollection from 'tint/icons/20-collection.svg?raw'
  import IconChevronRight from 'tint/icons/20-chevron-right.svg?raw'
  import IconWarning from 'tint/icons/20-warning.svg?raw'
  import IconHelp from 'tint/icons/20-help.svg?raw'
  import type { ValidatedFrameGroup } from '@src/types'

  async function loadGroup(group: ValidatedFrameGroup) {
    if (!group.isValid) return
    await errorStore.safeRequest('load-saved-group', group.id)
  }

  async function deleteGroup(e: MouseEvent, groupId: string) {
    e.stopPropagation()
    await errorStore.safeRequest('delete-saved-group', groupId)
  }

  function addNewConfiguration() {
    errorStore.safeRequest('skip-to-frame-selection')
  }

  function getFrameCount(group: ValidatedFrameGroup): number {
    if (typeof group.annotationInfoFrameId === 'string') {
      return 2 // annotation frame + single info frame
    }
    return 3 // annotation frame + navigation + notes
  }

  function getInvalidMessage(group: ValidatedFrameGroup): string {
    switch (group.invalidReason) {
      case 'deleted':
        return 'Frames have been deleted'
      case 'wrong-page':
        return 'Frames are on a different page'
      case 'wrong-type':
        return 'Frames are no longer the correct type'
      default:
        return 'Some frames are no longer valid'
    }
  }

  function _getInfoSummary(group: ValidatedFrameGroup): string {
    if (group.infoFrameNames?.single) {
      return group.infoFrameNames.single
    }
    if (group.infoFrameNames?.navigation && group.infoFrameNames?.notes) {
      return `${group.infoFrameNames.navigation}, ${group.infoFrameNames.notes}`
    }
    return 'Unknown frames'
  }
</script>

<Header title="Saved Configurations">
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

<div class="content">
  {#if $pluginState.savedGroups.length === 0}
    <MessageBox>
      <p>No saved configurations found.</p>
      <p class="tint--type-ui-small">
        Click "Add new" to set up your annotation frames.
      </p>
    </MessageBox>
  {:else}
    <ul class="groups-list">
      {#each $pluginState.savedGroups as group (group.id)}
        <li class="group-item" class:invalid={!group.isValid}>
          <button
            class="group-button"
            disabled={!group.isValid}
            onclick={() => loadGroup(group)}
          >
            <div class="group-icon">
              {#if group.isValid}
                {@html IconCollection}
              {:else}
                {@html IconWarning}
              {/if}
            </div>
            <div class="group-info">
              <span class="group-name tint--type-ui-bold">{group.name}</span>
              <span class="group-meta tint--type-ui-small">
                {group.mode === 'desktop' ? 'Desktop' : 'Mobile'} • {getFrameCount(
                  group,
                )} frames
              </span>
              {#if !group.isValid}
                <span class="group-warning tint--type-ui-small">
                  {getInvalidMessage(group)}
                </span>
              {/if}
            </div>
            {#if group.isValid}
              <span class="chevron">
                {@html IconChevronRight}
              </span>
            {/if}
          </button>
          <div class="group-actions">
            <Button
              icon
              variant="ghost"
              small
              aria-label="Delete configuration"
              tooltip="Delete"
              onclick={(e) => deleteGroup(e, group.id)}
            >
              {@html IconTrash}
            </Button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<div class="action">
  <Button variant="primary" onclick={addNewConfiguration}>
    Add new configuration
  </Button>
</div>

<style lang="sass">
.content
  flex: 1
  overflow-y: auto
  padding: tint.$size-12

.groups-list
  list-style: none
  margin: 0
  padding: 0
  border: 1px solid var(--tint-card-border)
  border-radius: tint.$size-4

.group-item
  display: flex
  align-items: center
  &:not(:last-child)
    border-bottom: 1px solid var(--tint-card-border)
  &.invalid
    opacity: 0.6

.group-button
  flex: 1
  display: flex
  align-items: center
  gap: tint.$size-12
  padding: tint.$size-12
  background: none
  border: none
  cursor: pointer
  text-align: left
  transition: background 0.15s ease
  &:hover:not(:disabled)
    background: var(--tint-action-secondary-hover)
  &:active:not(:disabled)
    background: var(--tint-action-secondary-active)
  &:disabled
    cursor: not-allowed

.group-icon
  width: tint.$size-24
  height: tint.$size-24
  display: flex
  align-items: center
  justify-content: center
  color: var(--tint-text-secondary)
  .invalid &
    color: var(--tint-action-destructive, #d93025)

.group-info
  flex: 1
  display: flex
  flex-direction: column
  gap: tint.$size-2
  min-width: 0

.group-name
  overflow: hidden
  text-overflow: ellipsis
  white-space: nowrap

.group-meta
  color: var(--tint-text-secondary)

.group-warning
  color: var(--tint-action-destructive, #d93025)

.group-actions
  display: flex
  align-items: center
  padding-right: tint.$size-8

.chevron
  width: tint.$size-24
  height: tint.$size-24
  display: flex
  align-items: center
  justify-content: center
  color: var(--tint-text-secondary)

.action
  display: flex
  flex-direction: column
  gap: tint.$size-8
  padding: tint.$size-12
  border-top: 1px solid var(--tint-card-border)

.button-icon
  display: inline-flex
  margin-right: tint.$size-4
</style>
