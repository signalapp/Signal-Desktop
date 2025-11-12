// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AriaRole as ReactAriaRole } from 'react';
import { getRole } from 'dom-accessibility-api';
import { assert } from './assert.dom.js';

const AbstractRoles = {
  /** Abstract Roles: https://www.w3.org/TR/wai-aria-1.2/#abstract_roles */
  command: true,
  composite: true,
  input: true,
  landmark: true,
  range: true,
  roletype: true,
  section: true,
  sectionhead: true,
  select: true,
  structure: true,
  widget: true,
  window: true,
} as const satisfies Record<string, true>;

export type AbstractAriaRole = keyof typeof AbstractRoles;
export type AriaRole =
  | Exclude<ReactAriaRole, object>
  // Missing from React's types
  | 'blockquote'
  | 'caption'
  | 'code'
  | 'deletion'
  | 'emphasis'
  | 'insertion'
  | 'meter'
  | 'paragraph'
  | 'strong'
  | 'subscript'
  | 'superscript'
  | 'time';

type ProhibitedAriaRole = 'generic';

type AnyAriaRole = AbstractAriaRole | AriaRole | ProhibitedAriaRole;

const ParentRoles = {
  /** Abstract Roles: https://www.w3.org/TR/wai-aria-1.2/#abstract_roles */
  command: ['widget'],
  composite: ['widget'],
  input: ['widget'],
  landmark: ['section'],
  range: ['structure'],
  roletype: [],
  section: ['structure'],
  sectionhead: ['structure'],
  select: ['composite', 'group'],
  structure: ['roletype'],
  widget: ['roletype'],
  window: ['roletype'],

  /** Widget Roles: https://www.w3.org/TR/wai-aria-1.2/#widget_roles */
  button: ['command'],
  checkbox: ['input'],
  gridcell: ['cell', 'widget'],
  link: ['command'],
  menuitem: ['command'],
  menuitemcheckbox: ['menuitem'],
  menuitemradio: ['menuitem'],
  option: ['input'],
  progressbar: ['range', 'widget'],
  radio: ['input'],
  scrollbar: ['range', 'widget'],
  searchbox: ['textbox'],
  separator: ['structure' /* no-focus */, 'widget' /* focus */],
  slider: ['input', 'range'],
  spinbutton: ['composite', 'input', 'range'],
  switch: ['checkbox'],
  tab: ['sectionhead', 'widget'],
  tabpanel: ['section'],
  textbox: ['input'],
  treeitem: ['listitem', 'option'],
  /** Composite Widget Roles */
  combobox: ['input'],
  grid: ['composite', 'table'],
  listbox: ['select'],
  menu: ['select'],
  menubar: ['menu'],
  radiogroup: ['select'],
  tablist: ['composite'],
  tree: ['select'],
  treegrid: ['grid', 'tree'],

  /** Document Structure Roles: https://www.w3.org/TR/wai-aria-1.2/#document_structure_roles */
  application: ['structure'],
  article: ['document'],
  blockquote: ['section'],
  caption: ['section'],
  cell: ['section'],
  code: ['section'],
  columnheader: ['cell', 'gridcell', 'sectionhead'],
  definition: ['section'],
  deletion: ['section'],
  directory: ['list'],
  document: ['structure'],
  emphasis: ['section'],
  feed: ['list'],
  figure: ['section'],
  generic: ['structure'],
  group: ['section'],
  heading: ['sectionhead'],
  img: ['section'],
  insertion: ['section'],
  list: ['section'],
  listitem: ['section'],
  math: ['section'],
  meter: ['range'],
  none: ['structure'],
  note: ['section'],
  paragraph: ['section'],
  presentation: ['structure'],
  row: ['group', 'widget'],
  rowgroup: ['structure'],
  rowheader: ['cell', 'gridcell', 'sectionhead'],
  // skip separator
  strong: ['section'],
  subscript: ['section'],
  superscript: ['section'],
  table: ['section'],
  term: ['section'],
  time: ['section'],
  toolbar: ['group'],
  tooltip: ['section'],

  /** Landmark Roles: https://www.w3.org/TR/wai-aria-1.2/#landmark_roles */
  banner: ['landmark'],
  complementary: ['landmark'],
  contentinfo: ['landmark'],
  form: ['landmark'],
  main: ['landmark'],
  navigation: ['landmark'],
  region: ['landmark'],
  search: ['landmark'],

  /** Live Region Roles: https://www.w3.org/TR/wai-aria-1.2/#live_region_roles */
  alert: ['section'],
  log: ['section'],
  marquee: ['section'],
  status: ['section'],
  timer: ['status'],

  /** Window Roles: https://www.w3.org/TR/wai-aria-1.2/#window_roles */
  alertdialog: ['alert', 'dialog'],
  dialog: ['window'],
} as const satisfies Record<AnyAriaRole, ReadonlyArray<AnyAriaRole>>;

function inherits(role: AnyAriaRole, superRole: AnyAriaRole): boolean {
  if (role === superRole) {
    return true;
  }

  const parentRoles = assert(ParentRoles[role], `Unknown Aria role: ${role}`);

  for (const parentRole of parentRoles) {
    if (inherits(parentRole, superRole)) {
      return true;
    }
  }

  return false;
}

export function isValidAriaRole(role: string | null): role is AriaRole {
  return role != null && Object.hasOwn(ParentRoles, role);
}

export function getElementAriaRole(element: Element): AriaRole | null {
  const role = getRole(element);
  if (isValidAriaRole(role)) {
    return role;
  }
  return null;
}

export function isAriaWidgetRole(role: AriaRole | null): boolean {
  return role != null && inherits(role, 'widget');
}
