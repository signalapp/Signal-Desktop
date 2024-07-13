// Copyright 2017 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MenuItemConstructorOptions } from 'electron';

export type MenuListType = Array<MenuItemConstructorOptions>;

export type MenuOptionsType = Readonly<{
  development: boolean;
  devTools: boolean;
  includeSetup: boolean;
  isProduction: boolean;
  platform: string;
}>;

export type MenuActionsType = Readonly<{
  forceUpdate: () => unknown;
  openArtCreator: () => unknown;
  openContactUs: () => unknown;
  openForums: () => unknown;
  openJoinTheBeta: () => unknown;
  openReleaseNotes: () => unknown;
  openSupportPage: () => unknown;
  setupAsNewDevice: () => unknown;
  setupAsStandalone: () => unknown;
  showAbout: () => unknown;
  showDebugLog: () => unknown;
  showCallingDevTools: () => unknown;
  showKeyboardShortcuts: () => unknown;
  showSettings: () => unknown;
  showWindow: () => unknown;
  zoomIn: () => unknown;
  zoomOut: () => unknown;
  zoomReset: () => unknown;
}>;

export type MenuActionType = keyof MenuActionsType;
