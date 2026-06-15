import desktopThumb from './assets/video-thumbnails/desktop.avif'
import mobileThumb from './assets/video-thumbnails/mobile.avif'

export type VideoMeta = {
  url: string
  thumbnail: string
  title: string
  duration: string
}

export const VIDEO_INTRO_DESKTOP: VideoMeta = {
  url: 'https://mozilla.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=f0e524b7-b8fa-4156-bc6a-b44500ae81a4',
  thumbnail: desktopThumb,
  title: 'Plugin walkthrough — Desktop',
  duration: '9:40',
}

export const VIDEO_INTRO_MOBILE: VideoMeta = {
  url: 'https://mozilla.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=2b2dc57d-5f1b-4ffb-8dbb-b44500ae81a5',
  thumbnail: mobileThumb,
  title: 'Plugin walkthrough — Mobile',
  duration: '6:48',
}

// Older, deeper-dive walkthrough focused on how annotations work
// (longer than the per-platform intro videos above).
export const LINK_GUIDE_VIDEO =
  'https://mozilla.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=bb2c54b8-be73-4da3-b643-b11700d8c765'

export const LINK_GUIDE_DOCS =
  'https://acorn.firefox.com/latest/support/resources/designer/a11y-figma-annotations-KFdQgdPq'
