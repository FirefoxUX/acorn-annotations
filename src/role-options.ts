import { SELECT_SEPARATOR } from 'tint/components/Select.svelte'

type SelectItem = { value: string; label: string; disabled?: boolean }
type RoleItem = SelectItem | typeof SELECT_SEPARATOR

const DESKTOP_COMMON = [
  'button',
  'link',
  'heading',
  'img',
  'navigation',
  'main',
  'search',
  'form',
  'list',
]

const DESKTOP_LESS_COMMON = [
  'banner',
  'complementary',
  'contentinfo',
  'region',
  'alert',
  'dialog',
  'tab',
  'tabpanel',
  'radio',
  'checkbox',
  'slider',
  'menu',
  'menuitem',
  'tooltip',
  'status',
  'progressbar',
  'section',
  'article',
  'figure',
  'table',
  'separator',
  'group',
  'listitem',
  'option',
  'textbox',
  'combobox',
  'switch',
  'tree',
  'treeitem',
]

const MOBILE_COMMON = [
  'button',
  'link',
  'heading',
  'image',
  'search field',
  'tab',
  'adjustable',
  'switch',
]

const MOBILE_LESS_COMMON = [
  'header',
  'alert',
  'dialog',
  'menu',
  'checkbox',
  'radio',
  'slider',
  'progressbar',
  'list',
  'navigation',
  'summary',
  'static text',
  'group',
]

function toItems(roles: string[]): SelectItem[] {
  return roles.map((r) => ({ value: r, label: r }))
}

const desktopRoles = new Set([...DESKTOP_COMMON, ...DESKTOP_LESS_COMMON])
const mobileRoles = new Set([...MOBILE_COMMON, ...MOBILE_LESS_COMMON])

export function getRoleItems(mode: 'desktop' | 'mobile'): RoleItem[] {
  const common = mode === 'desktop' ? DESKTOP_COMMON : MOBILE_COMMON
  const lessCommon =
    mode === 'desktop' ? DESKTOP_LESS_COMMON : MOBILE_LESS_COMMON

  return [
    { value: '---', label: '---' },
    ...toItems(common),
    SELECT_SEPARATOR,
    ...toItems(lessCommon),
  ]
}

export function isKnownRole(
  value: string,
  mode: 'desktop' | 'mobile',
): boolean {
  if (value === '---' || value === '') return true
  return mode === 'desktop' ? desktopRoles.has(value) : mobileRoles.has(value)
}
