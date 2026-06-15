<script lang="ts">
  import Modal from 'tint/components/Modal.svelte'
  import Button from 'tint/components/Button.svelte'
  import IconClose from 'tint/icons/20-close.svg?raw'
  import TutorialAnnotation from '@ui/assets/tutorial-annotation.gif?inline'
  import TutorialAnnotationInfo from '@ui/assets/tutorial-annotationinfo.gif?inline'

  interface Props {
    kind: 'annotation' | 'info' | null
    onclose: () => void
  }

  let { kind, onclose }: Props = $props()

  const CONTENT = {
    annotation: {
      title: 'Annotation frame',
      gif: TutorialAnnotation,
      gifAlt: 'Selecting an annotation frame in Figma',
      paragraphs: [
        {
          lead: 'Select',
          text: 'the frame that contains the designs you want to annotate.',
        },
        { lead: 'Set it', text: 'in the plugin UI.' },
        {
          lead: 'No auto layout.',
          text: 'Annotation components are placed directly in the frame, and auto layout would push them away from where the plugin puts them.',
        },
      ],
    },
    info: {
      title: 'Annotation info frame',
      gif: TutorialAnnotationInfo,
      gifAlt: 'Selecting an annotation info frame in Figma',
      paragraphs: [
        {
          lead: 'Select',
          text: 'the frame that contains (or should contain) the annotation info components.',
        },
        { lead: 'Set it', text: 'in the plugin UI.' },
        {
          lead: 'Auto layout required.',
          text: 'Info entries are rearranged automatically as they are added or removed.',
        },
      ],
    },
  } as const

  let content = $derived(kind ? CONTENT[kind] : null)
  let open = $derived(kind !== null)
</script>

<Modal {open} {onclose} class="setup-help-modal">
  {#if content}
    <div class="modal-body">
      <header class="modal-header">
        <h2 class="tint--type-body-bold">{content.title}</h2>
        <Button
          icon
          small
          variant="ghost"
          aria-label="Close"
          tooltip="Close"
          onclick={onclose}
        >
          {@html IconClose}
        </Button>
      </header>
      <img class="tutorial-gif" src={content.gif} alt={content.gifAlt} />
      <div class="tutorial-text">
        {#each content.paragraphs as p (p.lead)}
          <p><strong>{p.lead}</strong> {p.text}</p>
        {/each}
      </div>
    </div>
  {/if}
</Modal>

<style lang="sass">
:global(dialog.setup-help-modal)
  box-sizing: border-box
  width: 360px
  max-width: calc(100vw - tint.$size-16)
  padding: 0
  overflow: hidden

.modal-body
  box-sizing: border-box
  width: 100%
  display: flex
  flex-direction: column
  gap: tint.$size-12
  padding: tint.$size-16
  min-width: 0

.modal-header
  display: flex
  align-items: center
  justify-content: space-between
  gap: tint.$size-8
  min-width: 0
  h2
    margin: 0
    min-width: 0
    overflow-wrap: break-word

.tutorial-gif
  display: block
  width: 100%
  max-width: 100%
  height: auto
  border-radius: tint.$size-8
  background: var(--tint-input-bg)
  border: 1px solid var(--tint-card-border)

.tutorial-text
  display: flex
  flex-direction: column
  gap: tint.$size-8
  color: var(--tint-text)
  overflow-wrap: break-word
  p
    margin: 0
    line-height: 1.4
</style>
