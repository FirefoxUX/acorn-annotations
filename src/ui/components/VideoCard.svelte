<script lang="ts">
  import { messenger } from '@src/message-handler'
  import IconPlay from 'tint/icons/20-play.svg?raw'

  interface Props {
    href: string
    thumbnail: string
    title: string
    duration: string
  }

  let { href, thumbnail, title, duration }: Props = $props()

  function handleClick() {
    messenger.request('open-external-link', href)
  }
</script>

<button
  class="video-card"
  type="button"
  onclick={handleClick}
  aria-label="Watch {title}, {duration}"
>
  <span class="thumb-wrap">
    <img src={thumbnail} alt="" class="thumb" />
    <span class="play-circle" aria-hidden="true">{@html IconPlay}</span>
    <span class="duration" aria-hidden="true">{duration}</span>
  </span>
</button>

<style lang="sass">
.video-card
  display: block
  width: 100%
  padding: 0
  background: transparent
  border: none
  border-radius: tint.$size-8
  cursor: pointer
  text-align: left
  color: inherit
  font: inherit
  @include tint.effect-focus

  &:hover .play-circle, &:focus-visible .play-circle
    transform: translate(-50%, -50%) scale(1.05)
  &:active .play-circle
    transform: translate(-50%, -50%) scale(0.96)

.thumb-wrap
  position: relative
  display: block
  width: 100%
  border-radius: tint.$size-8
  overflow: hidden
  background: var(--tint-input-bg)

.thumb
  display: block
  width: 100%
  aspect-ratio: 16 / 9
  object-fit: cover

.play-circle
  position: absolute
  top: 50%
  left: 50%
  transform: translate(-50%, -50%)
  width: 48px
  height: 48px
  border-radius: 50%
  background: rgba(0, 0, 0, 0.6)
  color: #fff
  display: flex
  align-items: center
  justify-content: center
  pointer-events: none
  transition: transform 120ms ease-out

.duration
  position: absolute
  bottom: tint.$size-8
  right: tint.$size-8
  padding: tint.$size-4
  border-radius: tint.$size-4
  background: rgba(0, 0, 0, 0.7)
  color: #fff
  font-size: 12px
  line-height: 1
  font-variant-numeric: tabular-nums
  pointer-events: none
</style>
