<script lang="ts">
  import { annotations } from '../store/annotations'
  import { mergedInfoGroups } from '../store/debug'
  import { state as pluginState } from '@ui/store/state'
  import { messenger } from '@src/message-handler'

  type ManagerFrames = {
    annotationFrameId: string
    annotationInfoFrameId: string | { navigation: string; notes: string }
  }

  let managerFrames = $state<ManagerFrames | null>(null)

  async function refreshManagerFrames() {
    try {
      const info = await messenger.request('get-debug-info')
      if (info && 'managerFrames' in info && info.managerFrames) {
        managerFrames = info.managerFrames as ManagerFrames
      } else {
        managerFrames = null
      }
    } catch (err) {
      console.error('Failed to fetch debug frames:', err)
    }
  }

  $effect(() => {
    refreshManagerFrames()
  })

  // Handler to select and focus on a specific scene node
  function selectNode(nodeId: string) {
    messenger
      .request('select-scene-node', nodeId)
      .catch((err) => console.error('Failed to select node:', err))
  }
</script>

{#snippet nodeRefBtn(id: string | null)}
  {#if id}
    <button
      class="node-id-btn"
      title="Click to focus on this node"
      onclick={() => selectNode(id)}
    >
      <span class="monospace">
        {#if id && id.length > 2}
          {id.slice(0, -2)}<b>{id.slice(-2)}</b>
        {:else}
          {id}
        {/if}
      </span>
    </button>
  {:else}
    <span class="monospace">-/-</span>
  {/if}
{/snippet}

<div class="debug-table-view">
  <h1>Debug view</h1>

  <div class="table-container frames">
    <table>
      <thead>
        <tr>
          <th colspan="3">
            Frames <span class="frames-mode">mode: {$pluginState.mode}</span>
            <button class="refresh-btn" onclick={refreshManagerFrames}>↻</button
            >
          </th>
        </tr>
        <tr>
          <th>Slot</th>
          <th>publicState (UI)</th>
          <th>state manager (plugin)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>annotation frame</td>
          <td>
            {#if $pluginState.frames.annotationFrame}
              <span class="frame-name"
                >{$pluginState.frames.annotationFrame.name}</span
              >
              {@render nodeRefBtn($pluginState.frames.annotationFrame.id)}
            {:else}
              <span class="missing">null</span>
            {/if}
          </td>
          <td>
            {#if managerFrames}
              {@render nodeRefBtn(managerFrames.annotationFrameId)}
            {:else}
              <span class="missing">no manager</span>
            {/if}
          </td>
        </tr>
        <tr>
          <td>info frame</td>
          <td>
            {#if !$pluginState.frames.annotationInfoFrame}
              <span class="missing">null</span>
            {:else if 'id' in $pluginState.frames.annotationInfoFrame}
              <span class="frame-tag">single</span>
              <span class="frame-name"
                >{$pluginState.frames.annotationInfoFrame.name}</span
              >
              {@render nodeRefBtn($pluginState.frames.annotationInfoFrame.id)}
            {:else}
              <span class="frame-tag">split</span>
              <div class="split-row">
                <span class="split-label">nav:</span>
                {#if $pluginState.frames.annotationInfoFrame.navigation}
                  <span class="frame-name"
                    >{$pluginState.frames.annotationInfoFrame.navigation
                      .name}</span
                  >
                  {@render nodeRefBtn(
                    $pluginState.frames.annotationInfoFrame.navigation.id,
                  )}
                {:else}
                  <span class="missing">null</span>
                {/if}
              </div>
              <div class="split-row">
                <span class="split-label">notes:</span>
                {#if $pluginState.frames.annotationInfoFrame.notes}
                  <span class="frame-name"
                    >{$pluginState.frames.annotationInfoFrame.notes.name}</span
                  >
                  {@render nodeRefBtn(
                    $pluginState.frames.annotationInfoFrame.notes.id,
                  )}
                {:else}
                  <span class="missing">null</span>
                {/if}
              </div>
            {/if}
          </td>
          <td>
            {#if !managerFrames}
              <span class="missing">no manager</span>
            {:else if typeof managerFrames.annotationInfoFrameId === 'string'}
              <span class="frame-tag">single</span>
              {@render nodeRefBtn(managerFrames.annotationInfoFrameId)}
            {:else}
              <span class="frame-tag">split</span>
              <div class="split-row">
                <span class="split-label">nav:</span>
                {@render nodeRefBtn(
                  managerFrames.annotationInfoFrameId.navigation,
                )}
              </div>
              <div class="split-row">
                <span class="split-label">notes:</span>
                {@render nodeRefBtn(managerFrames.annotationInfoFrameId.notes)}
              </div>
            {/if}
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="table-container">
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Kind</th>
          <th>Annotation Nodes</th>
        </tr>
      </thead>
      <tbody>
        {#each $annotations as annotation (annotation.strReference)}
          <tr>
            <td>{annotation.strReference}</td>
            <td>{annotation.kind}</td>
            <td>
              <details class="node-tree">
                <summary>
                  <span class="node-count"
                    >{annotation.annotationNodeId.length} nodes</span
                  >
                </summary>
                <ul class="node-list">
                  {#each annotation.annotationNodeId as nodeId, index (nodeId || index)}
                    <li>
                      {@render nodeRefBtn(nodeId)}
                    </li>
                  {/each}
                </ul>
              </details>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  <div class="table-container">
    <table>
      <thead>
        <tr>
          <th>Info Node ID</th>
          <th>References</th>
          <th>Hash</th>
        </tr>
      </thead>
      <tbody>
        {#each $mergedInfoGroups as group, idx (group.infoNodeId || idx)}
          <tr>
            <td>
              {@render nodeRefBtn(group.infoNodeId)}
            </td>
            <td>
              <div class="references">
                {#each Array.from(group.references) as ref, i (i)}
                  <span class="reference">{ref}</span>
                {/each}
              </div>
            </td>
            <td class="monospace hash">{group.hash}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

<style lang="sass">
.debug-table-view
  padding: tint.$size-8
  flex: 1
  display: flex
  flex-direction: column
  overflow: hidden

.table-container
  margin-top: tint.$size-8
  flex: 1
  overflow-y: auto
  border: 1px solid var(--tint-card-border)
  border-radius: tint.$size-12

table
  width: 100%
  border-collapse: collapse
  font-size: 0.85rem

thead
  position: sticky
  top: 0
  background-color: var(--tint-bg)

th
  padding: tint.$size-8
  text-align: left
  border-bottom: 1px solid var(--tint-card-border)

td
  padding: tint.$size-8

tr:last-child td
  border-bottom: none

.monospace
  font-family: monospace
  font-size: 0.8rem

.hash
  max-width: 120px
  white-space: nowrap
  overflow: hidden
  text-overflow: ellipsis

.references
  display: flex
  flex-wrap: wrap
  gap: tint.$size-2

.reference
  background-color: var(--tint-card-background-hover)
  padding: tint.$size-2 tint.$size-4
  border-radius: tint.$size-4
  font-size: 0.8rem

.node-tree
  margin: 0
  padding: 0

.node-count
  font-size: 0.85rem

summary
  cursor: pointer
  user-select: none
  &:focus
    outline: none

.node-list
  list-style-type: none
  margin: tint.$size-4 0 0
  padding: 0
  max-height: 200px
  overflow-y: auto

.node-id-btn
  background: transparent
  border: none
  color: var(--tint-text-primary)
  cursor: pointer
  padding: tint.$size-2 tint.$size-4
  margin: tint.$size-2 0
  border-radius: tint.$size-4
  text-align: left
  width: 100%
  display: flex
  align-items: center
  font-family: inherit
  font-size: inherit
  &:hover
    background-color: var(--tint-action-secondary-hover)

.table-container.frames
  flex: 0 0 auto

.frames-mode
  font-weight: normal
  font-size: 0.75rem
  margin-inline-start: tint.$size-8
  color: var(--tint-text-secondary)

.refresh-btn
  float: right
  background: transparent
  border: 1px solid var(--tint-card-border)
  color: var(--tint-text-primary)
  cursor: pointer
  padding: 0 tint.$size-8
  border-radius: tint.$size-4
  font-family: inherit
  &:hover
    background-color: var(--tint-action-secondary-hover)

.frame-name
  font-size: 0.8rem
  color: var(--tint-text-primary)
  display: inline-block
  margin-inline-end: tint.$size-4

.frame-tag
  display: inline-block
  font-size: 0.7rem
  padding: 0 tint.$size-4
  border-radius: tint.$size-4
  background-color: var(--tint-card-background-hover)
  color: var(--tint-text-secondary)
  margin-inline-end: tint.$size-4

.split-row
  display: flex
  align-items: center
  gap: tint.$size-4

.split-label
  font-size: 0.75rem
  color: var(--tint-text-secondary)
  min-width: 36px

.missing
  font-style: italic
  color: var(--tint-text-secondary)
  font-size: 0.8rem
</style>
