<script lang="ts">
  import type { Snippet } from 'svelte'
  import { messenger } from '../../message-handler'

  /** Interface for the component props */
  interface Props {
    /** The URL to open when the link is clicked or activated via keyboard */
    href: string

    /** Optional class to apply to the span element */
    className?: string
    /** Optional children content to be rendered inside the link */
    children?: Snippet
  }

  // Use Svelte 5 $props() to get the component props
  let { href, className = '', children }: Props = $props()

  /** Handles clicks on the link and opens the URL via the Figma plugin API */
  function handleClick() {
    messenger.request('open-external-link', href)
  }

  /**
   * Handles keyboard events, activating the link on Enter or Space
   *
   * @param event Keyboard event
   */
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleClick()
    }
  }
</script>

<!--
  Custom link component that works within Figma plugins
  Styled as a link but implemented as a keyboard-accessible,
  interactive span element
-->
<span
  class={`fig-link ${className}`}
  onclick={handleClick}
  onkeydown={handleKeyDown}
  role="link"
  tabindex="0"
>
  {@render children?.()}
</span>

<style lang="sass">
  .fig-link
    color: var(--tint-text-link)
    cursor: pointer
    text-decoration: underline
    user-select: text
    @include tint.effect-focus
</style>
