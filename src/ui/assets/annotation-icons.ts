import IconTab from '@ui/assets/icons/20-tab.svg?raw'
import IconArrows from '@ui/assets/icons/20-arrows.svg?raw'
import IconNote from '@ui/assets/icons/20-note.svg?raw'
import IconNoteComponent from '@ui/assets/icons/20-note-component.svg?raw'
import IconEye from '@ui/assets/icons/20-eye.svg?raw'

const byName = {
  tab: IconTab,
  arrow: IconArrows,
  note: IconNote,
  noteComponent: IconNoteComponent,
  presentational: IconEye,
}

export default byName

// by AnnotationKind
export const iconFromKind = {
  tab: byName.tab,
  arrow: byName.arrow,
  note: byName.note,

  'component-note': byName.noteComponent,
  presentational: byName.presentational,
}
