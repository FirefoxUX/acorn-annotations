<script lang="ts">
  import { state as pluginState } from '@ui/store/state'
  import { errorStore } from '@ui/store/error'
  import { messenger } from '@src/message-handler'
  import Button from 'tint/components/Button.svelte'
  import IconBack from 'tint/icons/20-chevron-left.svg?raw'
  import IconForward from 'tint/icons/20-chevron-right.svg?raw'
  import IconClose from 'tint/icons/20-close.svg?raw'
  import IconLink from 'tint/icons/20-link.svg?raw'
  import FigLink from '@src/ui/components/FigLink.svelte'
  import VideoCard from '@src/ui/components/VideoCard.svelte'
  import {
    LINK_GUIDE_DOCS,
    LINK_GUIDE_VIDEO,
    VIDEO_INTRO_DESKTOP,
    VIDEO_INTRO_MOBILE,
  } from '../external-links'
  import { iconFromKind } from '@ui/assets/annotation-icons'

  // Icons for the plugin-usage pages
  import GraphicGroupingEntire from '@ui/assets/grouping-entire.svg?raw'
  import GraphicGroupingIndividual from '@ui/assets/grouping-individual.svg?raw'
  import GraphicModeSame from '@ui/assets/mode-same.svg?raw'
  import GraphicModeSeparate from '@ui/assets/mode-separate.svg?raw'
  import GraphicPadding from '@ui/assets/padding.svg?raw'

  type SubpageType =
    | 'start'
    | 'desktop-guide'
    | 'mobile-guide'
    | 'desktop-usage'
    | 'mobile-usage'
    | 'support'

  let subpage = $state<SubpageType>('start')

  // When the user is actively annotating, filter help content to their platform.
  // During setup (and other pre-annotation states) keep both platforms visible.
  let inAnnotation = $derived($pluginState.view === 'annotation')
  let activeMode = $derived($pluginState.mode)
  let showDesktop = $derived(!inAnnotation || activeMode === 'desktop')
  let showMobile = $derived(!inAnnotation || activeMode === 'mobile')

  function openExternal(url: string) {
    messenger.request('open-external-link', url)
  }
</script>

{#snippet subpageButton(page: SubpageType, title: string, description?: string)}
  <button class="subsection-button" onclick={() => (subpage = page)}>
    <strong>{title}</strong>
    {#if description}
      <p>{description}</p>
    {/if}
    <span aria-hidden="true">{@html IconForward}</span>
  </button>
{/snippet}

{#snippet externalLink(url: string, title: string, description?: string)}
  <button class="subsection-button" onclick={() => openExternal(url)}>
    <strong>{title}</strong>
    {#if description}
      <p>{description}</p>
    {/if}
    <span aria-hidden="true">{@html IconLink}</span>
  </button>
{/snippet}

<nav>
  <Button
    variant="ghost"
    small
    icon
    aria-label="Back"
    disabled={subpage === 'start'}
    onclick={() => (subpage = 'start')}>{@html IconBack}</Button
  >
  <h2>Help and Support</h2>
  <Button
    variant="ghost"
    small
    icon
    aria-label="Close"
    onclick={() => errorStore.safeRequest('toggle-sidebar', null)}
    >{@html IconClose}</Button
  >
</nav>
<div class="content docs-formatting padded">
  {#if subpage === 'start'}
    <p>
      Acorn Annotations helps you create accessibility annotations for your
      Figma designs.
    </p>

    {#if showDesktop}
      <h4 class="tint--type-body-sans section-heading">Desktop</h4>
      <div class="platform-group">
        <VideoCard
          href={VIDEO_INTRO_DESKTOP.url}
          thumbnail={VIDEO_INTRO_DESKTOP.thumbnail}
          title={VIDEO_INTRO_DESKTOP.title}
          duration={VIDEO_INTRO_DESKTOP.duration}
        />
        {@render subpageButton(
          'desktop-usage',
          'Using the plugin for Desktop',
          'Setup, creating, and managing annotations on desktop.',
        )}
        {@render subpageButton(
          'desktop-guide',
          'Annotating for Desktop',
          'What to annotate and why, for desktop designs.',
        )}
      </div>
    {/if}

    {#if showMobile}
      <h4 class="tint--type-body-sans section-heading">Mobile</h4>
      <div class="platform-group">
        <VideoCard
          href={VIDEO_INTRO_MOBILE.url}
          thumbnail={VIDEO_INTRO_MOBILE.thumbnail}
          title={VIDEO_INTRO_MOBILE.title}
          duration={VIDEO_INTRO_MOBILE.duration}
        />
        {@render subpageButton(
          'mobile-usage',
          'Using the plugin for Mobile',
          'Setup, creating, and managing annotations on mobile.',
        )}
        {@render subpageButton(
          'mobile-guide',
          'Annotating for Mobile',
          'What to annotate and why, for mobile designs.',
        )}
      </div>
    {/if}

    <h4 class="tint--type-body-sans section-heading">More resources</h4>

    {@render externalLink(
      LINK_GUIDE_VIDEO,
      'Full annotation video',
      'Deeper dive into how annotations work.',
    )}
    {@render externalLink(
      LINK_GUIDE_DOCS,
      'Written guide',
      'Read the annotation reference on the Acorn site.',
    )}
    {@render subpageButton(
      'support',
      'Support',
      'How to get in touch for help or to report issues.',
    )}
  {:else if subpage === 'desktop-usage'}
    <h3 class="tint--type-title-sans-2">Using the plugin for Desktop</h3>

    <p>
      Quick reference for operating the plugin in desktop mode. For what to
      annotate, see <em>Annotating for Desktop</em>.
    </p>

    <h4 class="tint--type-title-sans-3">1. Set up</h4>

    <ol>
      <li>
        <p>
          <strong>Copy</strong> the frame you want to annotate so the original stays
          untouched.
        </p>
      </li>
      <li>
        <p>
          <strong>Wrap your design</strong> in a frame
          <em>without auto-layout</em>. Quick wrap:
          <strong>Mac</strong>
          <kbd>⌥ Option</kbd>+<kbd>⌘ Command</kbd>+<kbd>G</kbd> ·
          <strong>Windows</strong>
          <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>G</kbd>.
        </p>
      </li>
      <li>
        <p>
          <strong>Create an info frame</strong> <em>with auto-layout</em>. Use
          the "Create info frame" button on the setup screen for a
          pre-configured one.
        </p>
      </li>
      <li>
        <p>
          <strong>Select Desktop</strong>, set both frames, then click
          <strong>Start annotating</strong>.
        </p>
      </li>
    </ol>

    <p>
      Optional: turn on <strong>Use separate info frames</strong> to keep tab/arrow
      info in a different frame from notes.
    </p>

    <h4 class="tint--type-title-sans-3">2. Create annotations</h4>

    <p>
      Select elements on the canvas, then use the controls at the top of the
      plugin.
    </p>

    <dl>
      <dt><strong>Annotation type</strong></dt>
      <dd>
        Tab, arrow, note, component-note, or presentational. Button colors match
        the selected type.
      </dd>

      <dt>
        <span class="help-icon">{@html GraphicGroupingEntire}</span>
        <span class="help-icon">{@html GraphicGroupingIndividual}</span>
        <strong>Selection grouping</strong> — Entire / Individual
      </dt>
      <dd>
        One annotation around everything you selected, or one per element.
      </dd>

      <dt>
        <span class="help-icon">{@html GraphicModeSame}</span>
        <span class="help-icon">{@html GraphicModeSeparate}</span>
        <strong>Annotation mode</strong> — Same / Separate
      </dt>
      <dd>
        With Individual: share one reference number across the new annotations,
        or give each its own. Disabled for Entire and for arrows (arrows always
        share).
      </dd>

      <dt>
        <span class="help-icon">{@html GraphicPadding}</span>
        <strong>Padding button</strong>
      </dt>
      <dd>Creates the annotation with extra space around the selection.</dd>
    </dl>

    <h4 class="tint--type-title-sans-3">3. Manage annotations</h4>

    <p>The list at the bottom shows everything you've annotated.</p>

    <ul>
      <li>
        Click an item to edit it. <kbd>Cmd</kbd>/<kbd>Ctrl</kbd>+click for
        multi-select, <kbd>Shift</kbd>+click for a range.
      </li>
      <li>
        Change kind in the edit panel — references reassign automatically when
        you cross between navigation (tab/arrow) and note categories.
      </li>
      <li>Drag list items to reorder.</li>
      <li>
        Per-item menu (three dots): <strong>Delete</strong> ·
        <strong>Select markers</strong> · <strong>Merge into</strong> ·
        <strong>Add to annotation</strong>.
      </li>
    </ul>

    <h4 class="tint--type-title-sans-3">Options menu (top right)</h4>

    <dl>
      <dt><strong>Layer locking</strong></dt>
      <dd>
        Locks design while you edit annotations (default), or the reverse —
        useful when repositioning markers.
      </dd>
      <dt><strong>Regroup annotations</strong></dt>
      <dd>Closes gaps in numbering and resolves duplicate references.</dd>
    </dl>

    <p>
      <strong>Tip:</strong> Edit in the plugin list rather than editing annotation
      components directly in Figma — the plugin keeps everything in sync.
    </p>
  {:else if subpage === 'mobile-usage'}
    <h3 class="tint--type-title-sans-2">Using the plugin for Mobile</h3>

    <p>
      Quick reference for operating the plugin in mobile mode. For what to
      annotate, see <em>Annotating for Mobile</em>.
    </p>

    <h4 class="tint--type-title-sans-3">1. Set up</h4>

    <ol>
      <li>
        <p>
          <strong>Copy</strong> the frame you want to annotate so the original stays
          untouched.
        </p>
      </li>
      <li>
        <p>
          <strong>Wrap your design</strong> in a frame
          <em>without auto-layout</em>. Quick wrap:
          <strong>Mac</strong>
          <kbd>⌥ Option</kbd>+<kbd>⌘ Command</kbd>+<kbd>G</kbd> ·
          <strong>Windows</strong>
          <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>G</kbd>.
        </p>
      </li>
      <li>
        <p>
          <strong>Create an info frame</strong> <em>with auto-layout</em>. Use
          the "Create info frame" button on the setup screen for a
          pre-configured one.
        </p>
      </li>
      <li>
        <p>
          <strong>Select Mobile</strong>, set both frames, then click
          <strong>Start annotating</strong>.
        </p>
      </li>
    </ol>

    <h4 class="tint--type-title-sans-3">2. Create annotations</h4>

    <p>
      Select elements on the canvas, then use the controls at the top of the
      plugin.
    </p>

    <dl>
      <dt><strong>Annotation type</strong></dt>
      <dd>Note, component-note, or presentational.</dd>

      <dt>
        <span class="help-icon">{@html GraphicGroupingEntire}</span>
        <span class="help-icon">{@html GraphicGroupingIndividual}</span>
        <strong>Selection grouping</strong> — Entire / Individual
      </dt>
      <dd>
        One annotation around everything you selected, or one per element.
      </dd>

      <dt>
        <span class="help-icon">{@html GraphicPadding}</span>
        <strong>Padding button</strong>
      </dt>
      <dd>Creates the annotation with extra space around the selection.</dd>
    </dl>

    <h4 class="tint--type-title-sans-3">3. Manage annotations</h4>

    <p>The list at the bottom shows everything you've annotated.</p>

    <ul>
      <li>
        Click an item to edit it. <kbd>Cmd</kbd>/<kbd>Ctrl</kbd>+click for
        multi-select, <kbd>Shift</kbd>+click for a range.
      </li>
      <li>Change kind in the edit panel.</li>
      <li>Drag list items to reorder.</li>
      <li>
        Per-item menu (three dots): <strong>Delete</strong> ·
        <strong>Select markers</strong> · <strong>Merge into</strong> ·
        <strong>Add to annotation</strong>.
      </li>
    </ul>

    <h4 class="tint--type-title-sans-3">Options menu (top right)</h4>

    <dl>
      <dt><strong>Layer locking</strong></dt>
      <dd>
        Locks design while you edit annotations (default), or the reverse.
      </dd>
      <dt><strong>Regroup annotations</strong></dt>
      <dd>Closes gaps in numbering and resolves duplicate references.</dd>
    </dl>

    <p>
      <strong>Tip:</strong> Edit in the plugin list rather than editing annotation
      components directly in Figma — the plugin keeps everything in sync.
    </p>
  {:else if subpage === 'desktop-guide'}
    <h3 class="tint--type-title-sans-2">Annotating for Desktop</h3>

    <p>
      Desktop annotations cover keyboard focus order and element semantics. Work
      through your design element by element, asking whether each one is
      interactive, non-interactive, or decorative.
    </p>

    <h4 class="tint--type-title-sans-3">Step 1 — Interactive elements</h4>

    <p>
      Annotate every element a keyboard user can reach with Tab using a
      <strong>tab</strong> annotation.
    </p>

    <dl>
      <dt>
        <span class="type-icon tab">{@html iconFromKind.tab}</span>
        <strong>Tab navigation</strong>
      </dt>
      <dd>
        <ul>
          <li>
            Applies to: buttons, links, text fields, dropdowns, checkboxes,
            radio button groups (the group as a whole)
          </li>
          <li>Numbered sequentially starting from 1 (1, 2, 3…)</li>
          <li>
            Form controls (dropdowns, checkboxes, radio buttons) use tab only —
            their internal arrow-key behavior is standard and doesn't need extra
            annotation
          </li>
        </ul>
      </dd>
    </dl>

    <p>
      Use an <strong>arrow-key navigation</strong> annotation for elements within
      a tab-focused group that are navigated using arrow keys.
    </p>

    <dl>
      <dt>
        <span class="type-icon arrow">{@html iconFromKind.arrow}</span>
        <strong>Arrow-key navigation</strong>
      </dt>
      <dd>
        <ul>
          <li>
            Applies to: individual radio buttons, list items, columns in a
            two-dimensional list
          </li>
          <li>
            Numbered with the parent tab number plus a letter suffix (3A, 3B,
            3C…)
          </li>
          <li>
            Elements of the same type within a group share a letter — in a list
            with two buttons per row, every first button is 3A and every second
            is 3B
          </li>
        </ul>
      </dd>
    </dl>

    <h4 class="tint--type-title-sans-3">Step 2 — Non-interactive elements</h4>

    <p>
      Use a <strong>note</strong> annotation for elements that need description but
      aren't keyboard targets.
    </p>

    <dl>
      <dt>
        <span class="type-icon note">{@html iconFromKind.note}</span>
        <strong>Note</strong>
      </dt>
      <dd>
        <ul>
          <li>
            <strong>Icons and images without text labels</strong> — set a text alternative
            as the name (e.g., "Back", "Close", "Settings")
          </li>
          <li>
            <strong>Headings</strong> — set the role to the heading level ("heading
            1", "heading 2")
          </li>
          <li>
            <strong>Landmarks</strong> — navigation, main, search, sections or cards,
            form. Set the role to the landmark type. The name field can be omitted.
          </li>
        </ul>
      </dd>
    </dl>

    <p>Note annotations are lettered (A, B, C…), separate from focus order.</p>

    <h4 class="tint--type-title-sans-3">Step 3 — Decorative elements</h4>

    <p>
      Mark decorative elements as <strong>presentational</strong> so screen readers
      skip them entirely.
    </p>

    <dl>
      <dt>
        <span class="type-icon presentational"
          >{@html iconFromKind.presentational}</span
        >
        <strong>Presentational</strong>
      </dt>
      <dd>
        <ul>
          <li>
            Applies to: decorative illustrations, background images, icons that
            duplicate adjacent visible text
          </li>
          <li>No fields needed — the role is pre-set to "presentational"</li>
          <li>Lettered (A, B, C…) alongside notes</li>
        </ul>
      </dd>
    </dl>

    <h4 class="tint--type-title-sans-3">Step 4 — Known Acorn components</h4>

    <p>
      If an element maps to a known Acorn design system component, use a
      <strong>component note</strong> instead of a regular tab, arrow, or note annotation.
    </p>

    <dl>
      <dt>
        <span class="type-icon component-note"
          >{@html iconFromKind['component-note']}</span
        >
        <strong>Component note</strong>
      </dt>
      <dd>
        <ul>
          <li>
            Fields: Component name and Note (optional). Name and role are
            intentionally absent — they're defined in the component
            specification.
          </li>
          <li>
            Use this as shorthand when the component already has a full
            accessibility spec. Use a regular annotation when the element needs
            custom name/role/note information.
          </li>
        </ul>
      </dd>
    </dl>

    <h4 class="tint--type-title-sans-3">Numbering reference</h4>

    <table>
      <thead>
        <tr>
          <th>Type</th>
          <th>Reference format</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Tab</td>
          <td>1, 2, 3…</td>
        </tr>
        <tr>
          <td>Arrow</td>
          <td>1A, 1B… 2A, 2B…</td>
        </tr>
        <tr>
          <td>Note / Component note / Presentational</td>
          <td>A, B, C…</td>
        </tr>
      </tbody>
    </table>
  {:else if subpage === 'mobile-guide'}
    <h3 class="tint--type-title-sans-2">Annotating for Mobile</h3>

    <p>
      On mobile, screen reader users navigate by swiping through all visible
      elements in reading order. Annotate everything — interactive and
      non-interactive alike. Tab and arrow-key annotations are not used on
      mobile.
    </p>

    <h4 class="tint--type-title-sans-3">
      Step 1 — Annotate all visible elements
    </h4>

    <p>
      Use a <strong>note</strong> annotation for every element that carries information.
    </p>

    <dl>
      <dt>
        <span class="type-icon note">{@html iconFromKind.note}</span>
        <strong>Note</strong>
      </dt>
      <dd>
        <ul>
          <li>
            Applies to: buttons, links, text fields, controls, headings, and any
            text important for understanding the content
          </li>
          <li>
            Lettered sequentially in reading order (A, B, C…), left-to-right,
            top-to-bottom
          </li>
          <li>
            Set the role for interactive elements (e.g., "button", "link",
            "heading 2")
          </li>
        </ul>
      </dd>
    </dl>

    <p>
      <strong>Grouping:</strong> Group related elements to reduce the number of swipe
      targets. Elements that belong together semantically — a badge and a title, or
      a card's header content — can share one annotation. Break down complex cards
      more granularly when they contain a lot of varied content.
    </p>

    <h4 class="tint--type-title-sans-3">Step 2 — Decorative elements</h4>

    <p>Mark decorative elements as <strong>presentational</strong>.</p>

    <dl>
      <dt>
        <span class="type-icon presentational"
          >{@html iconFromKind.presentational}</span
        >
        <strong>Presentational</strong>
      </dt>
      <dd>
        <ul>
          <li>
            Same rule as desktop: decorative illustrations, redundant icons,
            background images
          </li>
          <li>Lettered (A, B, C…), separate from reading order</li>
        </ul>
      </dd>
    </dl>

    <h4 class="tint--type-title-sans-3">Step 3 — Known Acorn components</h4>

    <p>
      Use a <strong>component note</strong> for elements that map to a known Acorn
      design system component.
    </p>

    <dl>
      <dt>
        <span class="type-icon component-note"
          >{@html iconFromKind['component-note']}</span
        >
        <strong>Component note</strong>
      </dt>
      <dd>
        <ul>
          <li>
            Same behavior as desktop — references the existing component
            specification
          </li>
          <li>
            Replaces a note annotation when no custom name/role/note is needed
          </li>
        </ul>
      </dd>
    </dl>

    <h4 class="tint--type-title-sans-3">Initial focus</h4>

    <p>
      Add a note to the element that should receive focus when a sheet, panel,
      or modal opens — typically the first form control or the close/dismiss
      button. Include this in the Note field: "First form control should receive
      focus when sheet opens."
    </p>

    <h4 class="tint--type-title-sans-3">Numbering reference</h4>

    <table>
      <thead>
        <tr>
          <th>Type</th>
          <th>Reference format</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Note / Component note</td>
          <td>A, B, C…</td>
        </tr>
        <tr>
          <td>Presentational</td>
          <td>A, B, C…</td>
        </tr>
      </tbody>
    </table>
  {:else if subpage === 'support'}
    <h3 class="tint--type-title-sans-2">Support</h3>

    <p>
      Need help with the Acorn Annotations plugin? We're here to assist you.
    </p>

    <h4 class="tint--type-title-sans-3">Get Help</h4>

    <p>For questions, issues, or feedback, reach out to us:</p>

    <ul>
      <li>
        <strong>Slack:</strong> Join us in the <code>#acorn-design-system</code>
        channel
      </li>
      <li>
        <strong>Email:</strong>
        <FigLink href="mailto:acorn-design-system@mozilla.com"
          >acorn-design-system@mozilla.com</FigLink
        >
      </li>
    </ul>

    <p>okthxbye!</p>
  {/if}
</div>

<style lang="sass">
  nav
    display: flex
    align-items: center
    padding: tint.$size-8
    gap: tint.$size-16
    border-bottom: 1px solid var(--tint-card-border)
    background-color: var(--tint-bg)
    h2
      text-align: center
      margin: 0
      flex: 1

  .content
    flex: 1
    overflow-y: auto
    &.padded
      padding: tint.$size-24

  .section-heading
    margin-block-start: tint.$size-24

  .platform-group
    margin-block-end: tint.$size-4
    :global(.video-card)
      margin-block-end: tint.$size-12

  .subsection-button
    display: grid
    grid-template-columns: 1fr auto
    padding: tint.$size-16
    border: 1px solid var(--tint-card-border)
    border-radius: tint.$size-12
    background: transparent
    text-align: start
    margin-block-end: tint.$size-12
    width: 100%
    box-sizing: border-box
    @include tint.effect-focus
    strong
      grid-row: 1
      grid-column: 1
    p
      grid-row: 2
      grid-column: 1
      margin: 0
    span
      grid-row: 1 / span 2
      grid-column: 2
      display: flex
      align-items: center
      justify-content: center

    &:not(:disabled):hover
      background-color: var(--tint-action-secondary-hover)
    &:not(:disabled):active
      background-color: var(--tint-action-secondary-active)

  .help-icon
    display: inline-flex
    align-items: center
    justify-content: center
    height: 20px
    vertical-align: middle
    margin-inline-end: tint.$size-4
    color: var(--tint-text-secondary)
    :global(svg)
      width: 100%
      height: 100%

  .type-icon
    display: inline-flex
    align-items: center
    justify-content: center
    height: 20px
    vertical-align: middle
    margin-inline-end: tint.$size-4
    :global(svg)
      width: 100%
      height: 100%
    &.tab
      color: var(--color-tab)
    &.arrow
      color: var(--color-arrow)
    &.note
      color: var(--color-note)
    &.component-note
      color: var(--color-component-note)
    &.presentational
      color: var(--color-presentational)
</style>
