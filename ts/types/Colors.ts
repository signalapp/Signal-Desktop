// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export const Colors = [
  'red',
  'deep_orange',
  'brown',
  'pink',
  'purple',
  'indigo',
  'blue',
  'teal',
  'green',
  'light_green',
  'blue_grey',
  'grey',
  'ultramarine',
  'signal-blue',
] as const;

export type ColorType = typeof Colors[number];
