export type ComponentPlatform = 'desktop' | 'android' | 'ios'

/**
 * Annotation kind chosen for a component when auto-annotation runs.
 *
 * - `tab` / `note`: applied to desktop components per their typical role.
 * - `skip`: the component is intentionally not annotated (e.g. wrappers whose
 *   children will be annotated individually). Mobile entries ignore this field
 *   — they always become `component-note`.
 */
export type AutoAnnotationKind = 'tab' | 'note' | 'skip'

export interface ComponentMapEntry {
  technicalName: string
  displayName: string
  platform: ComponentPlatform
  figmaComponentKeys: string[]
  annotationKind?: AutoAnnotationKind
  /**
   * When true, auto-annotation pads the marker around the component (matches
   * the "with padding" button in the UI). Useful for containers/groups whose
   * children sit flush with the bounds.
   */
  gap?: boolean
}

export const COMPONENT_MAP: ComponentMapEntry[] = [
  // ----
  // DESKTOP COMPONENTS
  // ----
  {
    technicalName: 'moz-badge',
    displayName: 'Badge',
    platform: 'desktop',
    annotationKind: 'note',
    figmaComponentKeys: [
      '02fb1cbc3fa8e87ac6d334b074737f2f757e7995', // Badge
      '103500df3f5f3e20f630a8790ade502b7fd336a8', // Badge (Nova)
    ],
  },
  {
    technicalName: 'moz-box-button',
    displayName: 'Box Button',
    platform: 'desktop',
    annotationKind: 'tab',
    figmaComponentKeys: [
      '2a1323040947e498ffea33776b92cd88e769e8e9', // Box / Button
      '2bc581d42f92580772f7a2ad788106824885ffdf', // Box / Button (Nova)
    ],
  },
  {
    technicalName: 'moz-box-group',
    displayName: 'Box Group',
    platform: 'desktop',
    annotationKind: 'note',
    gap: true,
    figmaComponentKeys: [
      '85e747ba7a18d237983f102d33df84b2137487c6', // Box / Group
      '53dd571786e4d1f45bf7455b99b954a0be601b46', // Box / Group (Nova)
    ],
  },
  {
    technicalName: 'moz-box-item',
    displayName: 'Box Item',
    platform: 'desktop',
    annotationKind: 'note',
    figmaComponentKeys: [
      'f4a5acf66ea95be055bae3d8340cbe11f76766b8', // Box / Item
      'd54e3fcb8e0f9cd43160f00122eefad6665c80be', // Box / Item (Nova)
    ],
  },
  {
    technicalName: 'moz-box-link',
    displayName: 'Box Link',
    platform: 'desktop',
    annotationKind: 'tab',
    figmaComponentKeys: [
      '6a9d0b68e010d04ff11b5c2983f137473d937a5e', // Box / Link
      'c28e4b768c4c7f105628a1fa1bceb73b2c6297d5', // Box / Link (Nova)
    ],
  },
  {
    technicalName: 'moz-breadcrumb-group',
    displayName: 'Breadcrumb Group',
    platform: 'desktop',
    annotationKind: 'note',
    gap: true,
    figmaComponentKeys: [],
  },
  {
    technicalName: 'moz-button',
    displayName: 'Button',
    platform: 'desktop',
    annotationKind: 'tab',
    figmaComponentKeys: [
      '3faec6bac359bc6bc836b3ff62c230b45e06c70f', // Button
      'f76d122d6762c71d730a7dd22ca5d0ec77bfcbf2', // Button (Nova)
      'f214f5e323d4fa5b81857db263b0e69ce143496f', // Icon Button
      '6722b01dccc6402f8adcf99c07fa31771fa1ca8d', // Icon Button (Nova)
      '14900ef7b89dfa9b71122c09d525de888b2d9df7', // Split Button
      '13eb7be3fdb2473ef01811e97d0043f906e0c188', // Split Button (Nova)
    ],
  },
  {
    technicalName: 'moz-button-group',
    displayName: 'Button Group',
    platform: 'desktop',
    annotationKind: 'skip',
    figmaComponentKeys: [
      'c76b82398f25d989d5d026b4d956799d3cc99938', // Button group
      '1a0a98a32f5b3715ca8fcb3d01f73da9955e0b6c', // Button group (Nova)
    ],
  },
  {
    technicalName: 'moz-card',
    displayName: 'Card',
    platform: 'desktop',
    annotationKind: 'note',
    figmaComponentKeys: [
      'd1170bce343865c3430d760127d521ac2f0a3139', // Card
      '4ed4455674e73e5175ebeb6562b248298a1552da', // Card (Nova)
    ],
  },
  {
    technicalName: 'moz-checkbox',
    displayName: 'Checkbox',
    platform: 'desktop',
    annotationKind: 'tab',
    figmaComponentKeys: [
      'ea082a74a444e2c8882d1f942dd24c55d94fda72', // Checkbox with label
      'a4a27efbe285b4ea008e67c973eb71816ca234fc', // Checkbox
      '0181728e7eec8a7f3f5de9a376b0472cc7cb3c58', // Checkbox (Nova)
      'ba85ec7765c77d3fee34a64e365c29acef53b6d2', // Checkbox / Input (Nova)
    ],
  },
  {
    technicalName: 'moz-fieldset',
    displayName: 'Fieldset',
    platform: 'desktop',
    annotationKind: 'note',
    gap: true,
    figmaComponentKeys: [
      'd1f4ed2a27f3888c5400fc1a3649def5ed49ad41', // Fieldset
      '8112a50c9e4f9ab7e8bcbb09fe68368f9c797550', // Fieldset (Nova)
    ],
  },
  {
    technicalName: 'moz-five-star',
    displayName: 'Five Star',
    platform: 'desktop',
    annotationKind: 'tab',
    figmaComponentKeys: [
      '10de3de0de9b742a6b7e29370b3f2168bcddacd9', // Five Stars
      'ae76d053a07d2276504e5757c5dd931b887abce8', // Five Stars (Nova)
    ],
  },
  {
    technicalName: 'moz-input-color',
    displayName: 'Input Color',
    platform: 'desktop',
    annotationKind: 'tab',
    figmaComponentKeys: [
      '0590759e9bae2663d167751b2fdd85da31f40ae2', // Input Color
      'c5364360554892bdf458459db7345b6db72e9105', // Color picker (Nova)
    ],
  },
  {
    technicalName: 'moz-input-folder',
    displayName: 'Input Folder',
    platform: 'desktop',
    annotationKind: 'tab',
    figmaComponentKeys: [],
  },
  {
    technicalName: 'moz-input-password',
    displayName: 'Input Password',
    platform: 'desktop',
    annotationKind: 'tab',
    figmaComponentKeys: [
      '5deb3dfd6ef0fcd7afecc164a64ace23c3b6c8f4', // Input Password
      'dc8b127f2a07a42972e8a7293fb2f86eec9e2493', // Input Password / Input
      'f512da7ea80326ccbe232cb6a2d1af13d5ffb93a', // Input Password (Nova)
      '6063acaf7d34bc72eecfea6fad53394d243faba7', // Input Password / Input (Nova)
    ],
  },
  {
    technicalName: 'moz-input-search',
    displayName: 'Input Search',
    platform: 'desktop',
    annotationKind: 'tab',
    figmaComponentKeys: [
      'fc8f56e06763b8cd06126359e7a79b07e5a17973', // Input Search
      'eddfc0aabd968a254fb1b32130a4214c4b8c6807', // Input Search / Input
      '4b9cd2aa318c5157745c239c6251478fa7ccaa9b', // Input Search (Nova)
      'd85f73dc285bba46c58b7895592bd7c31f90b7d0', // Input Search / Input (Nova)
    ],
  },
  {
    technicalName: 'moz-input-text',
    displayName: 'Input Text',
    platform: 'desktop',
    annotationKind: 'tab',
    figmaComponentKeys: [
      'e2da5f71b53bcc710f176556f1d4a4ca5fe9ec5b', // Input Text
      'c4167eff8e6907258b7a5d2ee41a8bace22421a7', // Input Text / Input
      '746e37674e8605236f8bb6f1e7f352666ea66db8', // Input Text (Nova)
      '16cb41fba7cdcf05760fa53ecc50184a2f61d07f', // Input Text / Input (Nova)
    ],
  },
  {
    technicalName: 'moz-label',
    displayName: 'Label',
    platform: 'desktop',
    annotationKind: 'note',
    figmaComponentKeys: [
      '06e492ffb2d304fab788e3c25d3774faf5da00db', // Label
      '305b3400793693894f227fb142134b3c2aceb3f5', // Label (Nova)
    ],
  },
  {
    technicalName: 'moz-message-bar',
    displayName: 'Message Bar',
    platform: 'desktop',
    annotationKind: 'note',
    figmaComponentKeys: [
      'df0010f61e8879691484579dcd505fa00592d6e2', // Message bar
      'feaef28b3e793928eecd31a24de43f5b716a9194', // Message bar (Nova)
    ],
  },
  {
    technicalName: 'moz-page-nav',
    displayName: 'Page Nav',
    platform: 'desktop',
    annotationKind: 'note',
    gap: true,
    figmaComponentKeys: [
      '938c834c072543fd3154465dc4d9b73b987d3dfe', // Page navigation
      'c83d952793ef54963dc696f2814495bdfb241972', // Page navigation (Nova)
    ],
  },
  {
    technicalName: 'moz-promo',
    displayName: 'Promo',
    platform: 'desktop',
    annotationKind: 'note',
    figmaComponentKeys: [
      'f78185a82b82ae599ac09ae0947b277874c63ea5', // Promo
      'c72d19f26a39188b8f56764e49f3d4ea6167e913', // Promo (Nova)
    ],
  },
  {
    technicalName: 'moz-radio-group',
    displayName: 'Radio Group',
    platform: 'desktop',
    annotationKind: 'note',
    gap: true,
    figmaComponentKeys: [
      'b664aadc7e67ee25a66fdc667f8c9fe208a26ade', // Radio Button with label
      '7b97463c1588b37fb3ba03223ac78e0f0ae4c3b5', // Radio Button
      'f937f29c32eab05f6bfed98dd9210fbe0f2f8dc5', // Radio (Nova)
      '0362475f46f0a428d163b20cb2ee879dc4a6279d', // Radio / Input (Nova)
    ],
  },
  {
    technicalName: 'moz-select',
    displayName: 'Select',
    platform: 'desktop',
    annotationKind: 'tab',
    figmaComponentKeys: [
      '2849549e31439cbe6b3ab488e83fcee26914d776', // Dropdown
      '2bd49d584e0db4b5f7a4c0bd18c5923f21eb47b2', // Dropdown / Button
      'fd6279c464233300bbd693967166bd5ddc0d4463', // Select (Nova)
      '3deebe6ab77a6e8628b99a6fa5c62e69b7467449', // Select / Input (Nova)
    ],
  },
  {
    technicalName: 'moz-support-link',
    displayName: 'Support Link',
    platform: 'desktop',
    annotationKind: 'tab',
    figmaComponentKeys: [],
  },
  {
    technicalName: 'moz-toggle',
    displayName: 'Toggle',
    platform: 'desktop',
    annotationKind: 'tab',
    figmaComponentKeys: [
      '867756713eaa6feddc0cdc8c88d244d639740283', // Toggle switch with label
      '6505c18efc779b19c828b8f2d32975ad3e7d3dd4', // Toggle switch
      '4ab3df8235b22f8d6c7ee93a8d1a30d6126f82a0', // Toggle (Nova)
      'db847096249e05e31c29cff8af43fc94eced7291', // Toggle / Input (Nova)
    ],
  },
  {
    technicalName: 'moz-visual-picker',
    displayName: 'Visual Picker',
    platform: 'desktop',
    annotationKind: 'note',
    gap: true,
    figmaComponentKeys: [
      'bb7ed508bed47793c0f9fe76b178c7ec5230870d', // Visual Picker Item
      '019c4e81987d7806cbd7c295141aa856d9f94d9d', // Visual Picker (Nova)
    ],
  },

  // ----
  // ANDROID COMPONENTS
  // ----
  {
    technicalName: 'TopAppBar',
    displayName: 'App bar',
    platform: 'android',
    figmaComponentKeys: [
      '052a4ddaab65bc6d2ebf8c68b32f803daaa2bfd6', // App bar
    ],
  },
  {
    technicalName: 'BadgedIcon',
    displayName: 'Badge',
    platform: 'android',
    figmaComponentKeys: [
      '304f1ff13098b1c1cde2e5295b69812ca92c2692', // Badge
    ],
  },
  {
    technicalName: 'InfoBanner',
    displayName: 'Banner',
    platform: 'android',
    figmaComponentKeys: [
      'd1064f058e17134bf2f626d53e3188d9db231893', // Banner
    ],
  },
  {
    technicalName: 'Bottom sheet', // unknown
    displayName: 'Bottom sheet',
    platform: 'android',
    figmaComponentKeys: [
      'e512f049d1cd1328ee8034a05234895b74414e7c', // Bottom sheet
    ],
  },
  {
    technicalName: 'MaterialButton',
    displayName: 'Button',
    platform: 'android',
    figmaComponentKeys: [
      '7720988962717b3f55c0802b135e15d562a2018f', // Button
    ],
  },
  {
    technicalName: 'FloatingActionButton',
    displayName: 'FAB',
    platform: 'android',
    figmaComponentKeys: [
      '994f4f9af601bf3773ce69ac66f423497982e8ba', // FAB
    ],
  },
  {
    technicalName: 'ExtendedFloatingActionButton',
    displayName: 'Extended FAB',
    platform: 'android',
    figmaComponentKeys: [
      'f6a29d84b2eb0ae811b543952a7039f41d82a075', // Extended FAB
    ],
  },
  {
    technicalName: 'IconButton',
    displayName: 'Icon button',
    platform: 'android',
    figmaComponentKeys: [
      '228a0d3e4c1f8907ab8bad23e584a99845c50603', // Icon button
    ],
  },
  {
    technicalName: 'TabGridTabItem',
    displayName: 'Tab card',
    platform: 'android',
    figmaComponentKeys: [
      '528ff897536bedb7c7cb519596a009669d62f245', // Tab card
    ],
  },
  {
    technicalName: 'InfoCard',
    displayName: 'Info card',
    platform: 'android',
    figmaComponentKeys: [
      '292ff03c0add79afcdc97ef5e46f5fd8d1f1d4f1', // Info card
    ],
  },
  {
    technicalName: 'Promo card', // unknown
    displayName: 'Promo card',
    platform: 'android',
    figmaComponentKeys: [
      '86fbb860e917d7032b8f856c6727c37d51c6a784', // Promo card
    ],
  },
  {
    technicalName: 'BrowserToolbarCFRPresenter',
    displayName: 'CFR',
    platform: 'android',
    figmaComponentKeys: [
      '80b47d8d5808b0a31d2c489a28f1bccc1663d1e9', // CFR
    ],
  },
  {
    technicalName: 'CFR - New', // unknown
    displayName: 'CFR - New',
    platform: 'android',
    figmaComponentKeys: [
      '214a88b4bdf79f13484234803e3d93bea49cbee0', // CFR - New
    ],
  },
  {
    technicalName: 'Checkbox',
    displayName: 'Checkbox',
    platform: 'android',
    figmaComponentKeys: [
      '7ee1881b97d377a111ea0f1279bf34c236533889', // Checkbox
    ],
  },
  {
    technicalName: 'Chip group', // unknown
    displayName: 'Chip group',
    platform: 'android',
    figmaComponentKeys: [
      '8328a770de6c811e71af311e7d136ec10e0da62f', // Chip group
    ],
  },
  {
    technicalName: 'SelectableChip',
    displayName: 'Filter chip',
    platform: 'android',
    figmaComponentKeys: [
      'ffb69c9efe62eb454677127e09a6adb4116935ce', // Filter chip
    ],
  },
  {
    technicalName: 'Material Dialog',
    displayName: 'Basic dialog',
    platform: 'android',
    figmaComponentKeys: [
      '5e4b2e9be0f49e4f6cc21bec8c37f82b1e6b1522', // Basic dialog
    ],
  },
  {
    technicalName: 'List dialog', // unknown
    displayName: 'List dialog',
    platform: 'android',
    figmaComponentKeys: [
      'bc848c7b89923a119ee49338b57c6cd3d916f860', // List dialog
    ],
  },
  {
    technicalName: 'HorizontalDivider',
    displayName: 'Divider',
    platform: 'android',
    figmaComponentKeys: [
      'aaa4d71ef5c2df2ea2820b9eda902b4039bb905f', // Divider
    ],
  },
  {
    technicalName: 'DropdownMenu',
    displayName: 'Dropdown',
    platform: 'android',
    figmaComponentKeys: [
      '3f00a380e3d4685ff9f876f35cddbbd8f3b4e4c6', // Dropdown
    ],
  },
  {
    technicalName: 'Empty State', // unknown
    displayName: 'Empty State',
    platform: 'android',
    figmaComponentKeys: [
      '3785887df712ee85330ef7d75874ed6e97bf4068', // Empty State
    ],
  },
  {
    technicalName: 'IconListItem',
    displayName: 'List',
    platform: 'android',
    figmaComponentKeys: [
      'b6bbc3d3d28477b5cfd2713538be650b44127e43', // List
    ],
  },
  {
    technicalName: 'MenuDialogFragment',
    displayName: 'Menu',
    platform: 'android',
    figmaComponentKeys: [
      '0c7c76be2e1c415fb3951952c0aeb1ffc9a82bed', // Menu
    ],
  },
  {
    technicalName: 'LinearProgressIndicator',
    displayName: 'Progress indicator - Linear determinate',
    platform: 'android',
    figmaComponentKeys: [
      'af8e7d4f40f288b82dd373fc7b8db9effe992162', // Progress indicator - Linear determinate
    ],
  },
  {
    technicalName: 'RadioButtonPreference',
    displayName: 'Radio buttons',
    platform: 'android',
    figmaComponentKeys: [
      '9a49acb24bd2485d81a363fea968441c213ae43b', // Radio buttons
    ],
  },
  {
    technicalName: 'HomeToolbarView',
    displayName: 'Search bar',
    platform: 'android',
    figmaComponentKeys: [
      '712a49f3981876071d66a33aea7df70f4074a9ab', // Search bar
    ],
  },
  {
    technicalName: 'SearchDialogFragment',
    displayName: 'Search view modal',
    platform: 'android',
    figmaComponentKeys: [
      'a97fe669a7a4a7d9cd1123aafdf948d52352f247', // Search view modal
      '4f8495fc820c2f76618830450588c65f203c48c6', // Search view full-screen
    ],
  },
  {
    technicalName: 'TopSites',
    displayName: 'Shortcut group',
    platform: 'android',
    figmaComponentKeys: [
      '794fb9d43e6534fb8f478b2a03a8f10275897821', // Shortcut group
    ],
  },
  {
    technicalName: 'Site menu', // unknown
    displayName: 'Site menu',
    platform: 'android',
    figmaComponentKeys: [
      'bc167eda1d7da92e581bc96add6ec7e6942a217b', // Site menu
    ],
  },
  {
    technicalName: 'Snackbar',
    displayName: 'Snackbar',
    platform: 'android',
    figmaComponentKeys: [
      '579662f16498c7e8e01e4c7266e4e0918599be13', // Snackbar
    ],
  },
  {
    technicalName: 'MaterialSwitch',
    displayName: 'Switch',
    platform: 'android',
    figmaComponentKeys: [
      '6d5bf55a51d0b0b25b03277d275987139eff5cd0', // Switch
    ],
  },
  {
    technicalName: 'TabLayout',
    displayName: 'Tabs',
    platform: 'android',
    figmaComponentKeys: [
      '3d476a7f525b173e423372074af2c891c606ac3c', // Tabs
    ],
  },
  {
    technicalName: 'TextInputLayout',
    displayName: 'Text field outlined',
    platform: 'android',
    figmaComponentKeys: [
      '61494955cfd88c0469a34c86893f04afa368cdde', // Text field outlined
    ],
  },
  {
    technicalName: 'BrowserToolbarView',
    displayName: 'Toolbar',
    platform: 'android',
    figmaComponentKeys: [
      '022b9935522f35cfca2c6c3cd221bbc82b7befe3', // Toolbar
    ],
  },
  {
    technicalName: 'BrowserNavigationBar',
    displayName: 'Expanded toolbar',
    platform: 'android',
    figmaComponentKeys: [
      '8e788e025f1c1fc9dfa67ba8256dc1712095f950', // Expanded toolbar
    ],
  },

  // ----
  // iOS COMPONENTS
  // ----
  {
    technicalName: 'ActionSheet',
    displayName: 'Action Sheet',
    platform: 'ios',
    figmaComponentKeys: [
      'f0ddc6218bcb4cd912d53a291c60ce6f44b0f791', // iOS18 - Action Sheet
      '69c5f64241d7bd129c8ec0acb5484b70f5f41158', // iOS26 - Action Sheet
    ],
  },
  {
    technicalName: 'BrowserAddressToolbar',
    displayName: 'Address Toolbar',
    platform: 'ios',
    figmaComponentKeys: [
      '1f55fcee5774cdf6c55dee3c80fab3f677232f57', // iOS18 - Address Toolbar
      'f7af85b9bbccec910fc31d4fed481d7116af43aa', // iOS26 - Address Toolbar
      'f644018e8539200465f5eb196f2f08bda2c954da', // iOS18 - Address Toolbar - iPad
      '7f1ad4c301b85f3c921f6a54e29fcb9ac6bc019f', // iOS26 - Address Toolbar - iPad
    ],
  },
  {
    technicalName: 'HeaderBanner',
    displayName: 'Banner',
    platform: 'ios',
    figmaComponentKeys: [
      '16909b1339d12afef57997c899ef9e92789a5d88', // Banner
    ],
  },
  {
    technicalName: 'BottomSheet',
    displayName: 'Sheet',
    platform: 'ios',
    figmaComponentKeys: [
      '624af1501727ab8cb52fc2c81f718013ced89385', // iOS18 - Sheet
      '8c791d2b68e246d9cf3669205212fc43ce34861f', // iOS26 - Sheet
      '2201d05e813a2d28ceba3f4deb252e0a4b24f357', // iOS18 - Sheet - iPad
      '3a2079cc2e0d4e4daef34c1ee7b49e1a923f51e8', // iOS26 - Sheet - iPad
    ],
  },
  {
    technicalName: 'PrimaryRoundedButton',
    displayName: 'Button - Text',
    platform: 'ios',
    figmaComponentKeys: [
      'ba82f3c2f60381ddd89daf99eecd0350023260d7', // iOS18 - Button - Text
      'c4a6bd4a65a96eff3b6f3ee9d69c90e87520b5a6', // iOS26 - Button - Text
    ],
  },
  {
    technicalName: 'IconButton',
    displayName: 'Button - Icon',
    platform: 'ios',
    figmaComponentKeys: [
      '383b08623f76c53de1516220ae96937448e6718e', // Button - Icon
      'aab7bc6e2e0e1659c9b85169ce47792daa44a668', // iOS26 - Button - Icon
    ],
  },
  {
    technicalName: 'TabCell',
    displayName: 'Tab Card',
    platform: 'ios',
    figmaComponentKeys: [
      'e41d8780550e4685495c39c1e78ebab69d308fc3', // Tab Card
    ],
  },
  {
    technicalName: 'CardGroup', // unknown
    displayName: 'Card Group',
    platform: 'ios',
    figmaComponentKeys: [
      'd71ebf9db7639fa0187b065c68dadd4355e67cd0', // Card group
    ],
  },
  {
    technicalName: 'ShadowCardView',
    displayName: 'Info Card',
    platform: 'ios',
    figmaComponentKeys: [
      '5e2b48b7502fda2cd6c5cb0bd5cb18097874563f', // Info Card
    ],
  },
  {
    technicalName: 'ContextualHintView',
    displayName: 'CFR',
    platform: 'ios',
    figmaComponentKeys: [
      'b23681b1f31a59bc56504bc114bdb3b5499ce577', // CFR
      '15374daa588a37ae9ce8a11a8ae700887d0d5df3', // CFR - New
    ],
  },
  {
    technicalName: 'ContextMenu',
    displayName: 'Context Menu',
    platform: 'ios',
    figmaComponentKeys: [
      'f29c5aac0d85902087c139f56cc26c7e31852795', // iOS18 - Context Menu
      '167c8f4626dc2e22479a3006811c782b1dc775ca', // iOS26 - Context Menu
      '644d157d8f0bb0f198f4805510904bc132405e6c', // .iOS18 - Context menu item
      'a4c89c5a0c4145fdeafea1e208fd584dc85ade8a', // .iOS26 - Context menu item
    ],
  },
  {
    technicalName: 'Divider',
    displayName: 'Divider',
    platform: 'ios',
    figmaComponentKeys: [
      '18e4accc29935b16ddce01881998d73dabdc257f', // Divider
    ],
  },
  {
    technicalName: 'EmptyStateView',
    displayName: 'Empty State',
    platform: 'ios',
    figmaComponentKeys: [
      '6b696bf10f492266f8568cd3debec58127e662e6', // OS Empty State
    ],
  },
  {
    technicalName: 'Form', // unknown
    displayName: 'Form',
    platform: 'ios',
    figmaComponentKeys: [
      'bbc72fb79cf910fec9ccc278fac6931e4f2f1e8d', // iOS18 - Form
      '1566e2c0e5565cb404d92a202f6aff5dbab83341', // iOS26 - Form
    ],
  },
  {
    technicalName: 'ListCell',
    displayName: 'List',
    platform: 'ios',
    figmaComponentKeys: [
      '3132ef4b0e2fe2d63b239503f0355f9a8850ddd6', // iOS18 - List Default
      '26488d104d3170764fc5f555b4634af9a44688ad', // iOS18 - List Expandable
      'd1cc58dadf976dcbb5aaf5fd7da7fd0094658909', // iOS18 - List Centered
      '07c1b0ffe9a59216f240ebaaabbcd26c47632cc3', // iOS26 - List
      'a376cd8d7662e6589d4eb7c3f445b4c81816845c', // .iOS18 - List - Centered List Item
      '93cfaf68816876a3d52f0ea6f51da9d4a6aa8c82', // .iOS18 - List - List Item with Description
      '5f9c226e2544ea66f41857052c2b0ba968017a07', // .iOS26 - List - List item
      '293b9e0f82f472f693482762f1cde0f46c69b64a', // .iOS26 - List - List item - Button
    ],
  },
  {
    technicalName: 'NavigationBar',
    displayName: 'Nav Bar',
    platform: 'ios',
    figmaComponentKeys: [
      'fb379b077ea21e2cd09ad8b71a73f1ef851bd0e4', // iOS18 - Nav Bar
      '157b4b298932c168f9aa0b2a5728366e289b1afe', // iOS18 - Modal Nav Bar
      '96d8a0b6bdd225ac9f3e93dc2edce1b91bcf2988', // iOS18 - Modal Nav Bar - iPad
      'ecc78e1a5e1cfc5b155e40605fe6bfd862a84143', // iOS18 - Nav Bar - iPad
    ],
  },
  {
    technicalName: 'BrowserNavigationToolbar',
    displayName: 'Navigation Toolbar',
    platform: 'ios',
    figmaComponentKeys: [
      '9d9236c14833b23abe30e513c3fd029c07cda7f1', // iOS18 - Navigation Toolbar
      'f15c84a6e57bd515cf2a6cd4920da984850af595', // iOS26 - Navigation Toolbar
    ],
  },
  {
    technicalName: 'PageControl',
    displayName: 'Page Control',
    platform: 'ios',
    figmaComponentKeys: [
      '90aa88d970bf2592597c04c7a24c15f5599af636', // Page Control
    ],
  },
  {
    technicalName: 'SearchField',
    displayName: 'Search Field',
    platform: 'ios',
    figmaComponentKeys: [
      '72a4b184e47adcc7ef1aaafb3812dbdb349c96bc', // iOS18 - Search Field
      'd3c2ba2ec52dd9223b2e4c591870f61cb532c067', // iOS26 - Search Field
    ],
  },
  {
    technicalName: 'SegmentedControl',
    displayName: 'Segmented Control',
    platform: 'ios',
    figmaComponentKeys: [
      'bb30ad75a6815bbcb930c95d212cb4d3e5be4e2a', // iOS18 - Segmented Control
      '9f5e75adf03592df839e86d81fdcd678931cd98f', // iOS26 - Segmented Control
    ],
  },
  {
    technicalName: 'ShareSheet',
    displayName: 'Share Sheet',
    platform: 'ios',
    figmaComponentKeys: [
      '061ecadb3a7779dd3cfe0a75605f8475cde5b3e4', // iOS18 - Share Sheet
      '82abf5a83f4f01e2586401e64deab7280a2605e3', // iOS26 - Share Sheet
    ],
  },
  {
    technicalName: 'TopSites',
    displayName: 'Shortcut Section',
    platform: 'ios',
    figmaComponentKeys: [
      '9c559105fc400c1b8b7297108efe49cea04ff88f', // Shortcut section
    ],
  },
  {
    technicalName: 'SiteMenu',
    displayName: 'Site Menu',
    platform: 'ios',
    figmaComponentKeys: [
      'a662683b574a4a7a81875955b5032bf9bda57d07', // Type=Site menu
      'c58a2b03e1ce40b2e0db2cf85b809b378cac295f', // iOS18 - Site Menu
      '555e34c04247e3c55c5e8cd65d4ce9d588c11493', // iOS26 - Site Menu
    ],
  },
  {
    technicalName: 'SimpleToast',
    displayName: 'Toast',
    platform: 'ios',
    figmaComponentKeys: [
      '170729e14d0c60ddab69b236a9e09a110d7d903d', // Toast
    ],
  },
  {
    technicalName: 'ThemedSwitch',
    displayName: 'Toggle',
    platform: 'ios',
    figmaComponentKeys: [
      'eae3390ced99576cb98a92ad2620e125f785aaea', // iOS18 - Toggle
      'fc2e374cb1621f7bd6dec273627f425a5d674074', // iOS26 - Toggle
    ],
  },
  {
    technicalName: 'Toolbar',
    displayName: 'Toolbar',
    platform: 'ios',
    figmaComponentKeys: [
      '6e2a4babcfb45269fae84938d1d0336e5d3504cc', // iOS18 - Toolbar
      '8a439083094fe1a66256e22cfe5c52843e617245', // iOS26 - Toolbar
      'd0ff29773e73aceb5a81e10d71d83c1c10ef6b1c', // iOS18 - Toolbar - iPad
      'afc67f413b0d9da2e9388dfd3484e0b1c574f7c5', // iOS26 - Toolbar - iPad
    ],
  },
]

type Mode = 'desktop' | 'mobile'

const PLATFORMS_BY_MODE: Record<Mode, ComponentPlatform[]> = {
  desktop: ['desktop'],
  mobile: ['android', 'ios'],
}

// Lookup maps for O(1) access
const technicalToDisplay = new Map(
  COMPONENT_MAP.map((e) => [e.technicalName, e.displayName]),
)
const figmaKeyToEntry = new Map(
  COMPONENT_MAP.flatMap((e) => e.figmaComponentKeys.map((key) => [key, e])),
)

const displayToTechnicalByMode: Record<Mode, Map<string, string>> = {
  desktop: new Map(),
  mobile: new Map(),
}
for (const entry of COMPONENT_MAP) {
  for (const mode of ['desktop', 'mobile'] as const) {
    if (PLATFORMS_BY_MODE[mode].includes(entry.platform)) {
      displayToTechnicalByMode[mode].set(entry.displayName, entry.technicalName)
    }
  }
}

/** Convert a technical name to its display name. Passthrough if unknown. */
export function toDisplayName(technicalName: string): string {
  return technicalToDisplay.get(technicalName) ?? technicalName
}

/**
 * Convert a display name to its technical name within a given mode. Passthrough
 * if unknown (supports free text).
 */
export function toTechnicalName(displayName: string, mode: Mode): string {
  return displayToTechnicalByMode[mode].get(displayName) ?? displayName
}

/** Find a component map entry by Figma component key (universal ID). */
export function findByFigmaKey(
  componentKey: string,
): ComponentMapEntry | undefined {
  return figmaKeyToEntry.get(componentKey)
}

/** Get autocomplete items for the given mode (desktop / mobile). */
export function getAutocompleteItems(
  mode: Mode,
): { value: string; label: string }[] {
  const platforms = PLATFORMS_BY_MODE[mode]
  return COMPONENT_MAP.filter((e) => platforms.includes(e.platform)).map(
    (e) => ({ value: e.displayName, label: e.displayName }),
  )
}

/**
 * Resolve which annotation kind auto-annotation should create for a known
 * component-map entry. Mobile entries always produce a `component-note`
 * (auto-fills the component name); desktop entries follow their
 * `annotationKind` field. Returns `'skip'` for components that should not be
 * auto-annotated.
 */
export function resolveAutoAnnotationKind(
  entry: ComponentMapEntry,
): 'tab' | 'note' | 'component-note' | 'skip' {
  if (entry.platform === 'desktop') {
    return entry.annotationKind ?? 'skip'
  }
  return 'component-note'
}
