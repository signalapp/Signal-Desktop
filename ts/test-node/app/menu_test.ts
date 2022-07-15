// Copyright 2018-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { stub } from 'sinon';
import type { MenuItemConstructorOptions } from 'electron';

import type { CreateTemplateOptionsType } from '../../../app/menu';
import { createTemplate } from '../../../app/menu';
import { load as loadLocale } from '../../../app/locale';
import type { MenuListType } from '../../types/menu';

const forceUpdate = stub();
const openContactUs = stub();
const openForums = stub();
const openJoinTheBeta = stub();
const openReleaseNotes = stub();
const openSupportPage = stub();
const setupAsNewDevice = stub();
const setupAsStandalone = stub();
const showAbout = stub();
const showDebugLog = stub();
const showKeyboardShortcuts = stub();
const showSettings = stub();
const showStickerCreator = stub();
const showWindow = stub();

const getExpectedEditMenu = (
  includeSpeech: boolean
): MenuItemConstructorOptions => ({
  label: '&Edit',
  submenu: [
    { label: 'Undo', role: 'undo' },
    { label: 'Redo', role: 'redo' },
    { type: 'separator' },
    { label: 'Cut', role: 'cut' },
    { label: 'Copy', role: 'copy' },
    { label: 'Paste', role: 'paste' },
    { label: 'Paste and Match Style', role: 'pasteAndMatchStyle' },
    { label: 'Delete', role: 'delete' },
    { label: 'Select All', role: 'selectAll' },
    ...(includeSpeech
      ? ([
          { type: 'separator' },
          {
            label: 'Speech',
            submenu: [
              { label: 'Start speaking', role: 'startSpeaking' },
              { label: 'Stop speaking', role: 'stopSpeaking' },
            ],
          },
        ] as MenuListType)
      : []),
  ],
});

const getExpectedViewMenu = (): MenuItemConstructorOptions => ({
  label: '&View',
  submenu: [
    { label: 'Actual Size', role: 'resetZoom' },
    { accelerator: 'CmdOrCtrl+=', label: 'Zoom In', role: 'zoomIn' },
    { label: 'Zoom Out', role: 'zoomOut' },
    { type: 'separator' },
    { label: 'Toggle Full Screen', role: 'togglefullscreen' },
    { type: 'separator' },
    { label: 'Debug Log', click: showDebugLog },
    { type: 'separator' },
    { label: 'Toggle Developer Tools', role: 'toggleDevTools' },
    { label: 'Force Update', click: forceUpdate },
  ],
});

const getExpectedHelpMenu = (
  includeAbout: boolean
): MenuItemConstructorOptions => ({
  label: '&Help',
  role: 'help',
  submenu: [
    {
      label: 'Show Keyboard Shortcuts',
      accelerator: 'CmdOrCtrl+/',
      click: showKeyboardShortcuts,
    },
    { type: 'separator' },
    { label: 'Contact Us', click: openContactUs },
    { label: 'Go to Release Notes', click: openReleaseNotes },
    { label: 'Go to Forums', click: openForums },
    { label: 'Go to Support Page', click: openSupportPage },
    { label: 'Join the Beta', click: openJoinTheBeta },
    ...(includeAbout
      ? ([
          { type: 'separator' },
          { label: 'About Signal Desktop', click: showAbout },
        ] as MenuListType)
      : []),
  ],
});

const EXPECTED_MACOS: MenuListType = [
  {
    label: 'Signal Desktop',
    submenu: [
      { label: 'About Signal Desktop', click: showAbout },
      { type: 'separator' },
      {
        label: 'Preferences…',
        accelerator: 'CommandOrControl+,',
        click: showSettings,
      },
      { type: 'separator' },
      { label: 'Services', role: 'services' },
      { type: 'separator' },
      { label: 'Hide', role: 'hide' },
      { label: 'Hide Others', role: 'hideOthers' },
      { label: 'Show All', role: 'unhide' },
      { type: 'separator' },
      { label: 'Quit Signal', role: 'quit' },
    ],
  },
  {
    label: '&File',
    submenu: [
      { label: 'Create/upload sticker pack', click: showStickerCreator },
      { type: 'separator' },
      { accelerator: 'CmdOrCtrl+W', label: 'Close Window', role: 'close' },
    ],
  },
  getExpectedEditMenu(true),
  getExpectedViewMenu(),
  {
    label: '&Window',
    role: 'window',
    submenu: [
      { label: 'Minimize', accelerator: 'CmdOrCtrl+M', role: 'minimize' },
      { label: 'Zoom', role: 'zoom' },
      { label: 'Show', accelerator: 'CmdOrCtrl+Shift+0', click: showWindow },
      { type: 'separator' },
      { label: 'Bring All to Front', role: 'front' },
    ],
  },
  getExpectedHelpMenu(false),
];

const EXPECTED_WINDOWS: MenuListType = [
  {
    label: '&File',
    submenu: [
      { label: 'Create/upload sticker pack', click: showStickerCreator },
      {
        label: 'Preferences…',
        accelerator: 'CommandOrControl+,',
        click: showSettings,
      },
      { type: 'separator' },
      { label: 'Quit Signal', role: 'quit' },
    ],
  },
  getExpectedEditMenu(false),
  getExpectedViewMenu(),
  {
    label: '&Window',
    role: 'window',
    submenu: [{ label: 'Minimize', role: 'minimize' }],
  },
  getExpectedHelpMenu(true),
];

const EXPECTED_LINUX: MenuListType = EXPECTED_WINDOWS.map(menuItem => {
  if (menuItem.label === '&View' && Array.isArray(menuItem.submenu)) {
    return {
      ...menuItem,
      submenu: menuItem.submenu.filter(
        submenuItem => submenuItem.label !== 'Force Update'
      ),
    };
  }
  return menuItem;
});

const PLATFORMS = [
  {
    label: 'macOS',
    platform: 'darwin',
    expectedDefault: EXPECTED_MACOS,
  },
  {
    label: 'Windows',
    platform: 'win32',
    expectedDefault: EXPECTED_WINDOWS,
  },
  {
    label: 'Linux',
    platform: 'linux',
    expectedDefault: EXPECTED_LINUX,
  },
];

describe('createTemplate', () => {
  const { messages } = loadLocale({
    appLocale: 'en',
    logger: {
      error(arg: unknown) {
        throw new Error(String(arg));
      },
      warn(arg: unknown) {
        throw new Error(String(arg));
      },
    },
  });

  const actions = {
    forceUpdate,
    openContactUs,
    openForums,
    openJoinTheBeta,
    openReleaseNotes,
    openSupportPage,
    setupAsNewDevice,
    setupAsStandalone,
    showAbout,
    showDebugLog,
    showKeyboardShortcuts,
    showSettings,
    showStickerCreator,
    showWindow,
  };

  PLATFORMS.forEach(({ label, platform, expectedDefault }) => {
    describe(label, () => {
      it('should return the correct template without setup options', () => {
        const options: CreateTemplateOptionsType = {
          development: false,
          devTools: true,
          includeSetup: false,
          isProduction: true,
          platform,
          ...actions,
        };

        const actual = createTemplate(options, messages);
        assert.deepEqual(actual, expectedDefault);
      });

      it('should return correct template with setup options', () => {
        const options: CreateTemplateOptionsType = {
          development: false,
          devTools: true,
          includeSetup: true,
          isProduction: true,
          platform,
          ...actions,
        };

        const expected: MenuListType = expectedDefault.map(menuItem => {
          if (menuItem.label === '&File' && Array.isArray(menuItem.submenu)) {
            return {
              ...menuItem,
              submenu: [
                { label: 'Set Up as New Device', click: setupAsNewDevice },
                { type: 'separator' },
                ...menuItem.submenu,
              ],
            };
          }
          return menuItem;
        });

        const actual = createTemplate(options, messages);
        assert.deepEqual(actual, expected);
      });
    });
  });
});
