// Copyright 2017 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isString } from 'lodash';

import type { LocalizerType } from '../ts/types/I18N';
import type {
  MenuListType,
  MenuOptionsType,
  MenuActionsType,
} from '../ts/types/menu';

export type CreateTemplateOptionsType = MenuOptionsType & MenuActionsType;

export const createTemplate = (
  options: CreateTemplateOptionsType,
  i18n: LocalizerType
): MenuListType => {
  if (!isString(options.platform)) {
    throw new TypeError('`options.platform` must be a string');
  }

  const {
    isProduction,
    devTools,
    includeSetup,
    openContactUs,
    openForums,
    openJoinTheBeta,
    openReleaseNotes,
    openSupportPage,
    platform,
    setupAsNewDevice,
    setupAsStandalone,
    forceUpdate,
    showAbout,
    showDebugLog,
    showCallingDevTools,
    showKeyboardShortcuts,
    showSettings,
    openArtCreator,
    zoomIn,
    zoomOut,
    zoomReset,
  } = options;

  const template: MenuListType = [
    {
      label: i18n('icu:mainMenuFile'),
      submenu: [
        {
          label: i18n('icu:mainMenuCreateStickers'),
          click: openArtCreator,
        },
        {
          label: i18n('icu:mainMenuSettings'),
          accelerator: 'CommandOrControl+,',
          click: showSettings,
        },
        {
          type: 'separator',
        },
        {
          role: 'quit',
          label: i18n('icu:appMenuQuit'),
        },
      ],
    },
    {
      label: i18n('icu:mainMenuEdit'),
      submenu: [
        {
          role: 'undo',
          label: i18n('icu:editMenuUndo'),
        },
        {
          role: 'redo',
          label: i18n('icu:editMenuRedo'),
        },
        {
          type: 'separator',
        },
        {
          role: 'cut',
          label: i18n('icu:editMenuCut'),
        },
        {
          role: 'copy',
          label: i18n('icu:editMenuCopy'),
        },
        {
          role: 'paste',
          label: i18n('icu:editMenuPaste'),
        },
        {
          role: 'pasteAndMatchStyle',
          label: i18n('icu:editMenuPasteAndMatchStyle'),
        },
        {
          role: 'delete',
          label: i18n('icu:editMenuDelete'),
        },
        {
          role: 'selectAll',
          label: i18n('icu:editMenuSelectAll'),
        },
      ],
    },
    {
      label: i18n('icu:mainMenuView'),
      submenu: [
        {
          accelerator: 'CmdOrCtrl+0',
          label: i18n('icu:viewMenuResetZoom'),
          click: zoomReset,
        },
        {
          accelerator: 'CmdOrCtrl+=',
          label: i18n('icu:viewMenuZoomIn'),
          click: zoomIn,
        },
        {
          accelerator: 'CmdOrCtrl+-',
          label: i18n('icu:viewMenuZoomOut'),
          click: zoomOut,
        },
        {
          type: 'separator',
        },
        {
          role: 'togglefullscreen',
          label: i18n('icu:viewMenuToggleFullScreen'),
        },
        {
          type: 'separator',
        },
        {
          label: i18n('icu:debugLog'),
          click: showDebugLog,
        },
        ...(devTools
          ? [
              {
                type: 'separator' as const,
              },
              {
                role: 'toggleDevTools' as const,
                label: i18n('icu:viewMenuToggleDevTools'),
              },
              {
                label: i18n('icu:viewMenuOpenCallingDevTools'),
                click: showCallingDevTools,
              },
            ]
          : []),
        ...(devTools && platform !== 'linux'
          ? [
              {
                label: i18n('icu:forceUpdate'),
                click: forceUpdate,
              },
            ]
          : []),
      ],
    },
    {
      label: i18n('icu:mainMenuWindow'),
      role: 'window',
      submenu: [
        {
          role: 'minimize',
          label: i18n('icu:windowMenuMinimize'),
        },
      ],
    },
    {
      label: i18n('icu:mainMenuHelp'),
      role: 'help',
      submenu: [
        {
          label: i18n('icu:helpMenuShowKeyboardShortcuts'),
          accelerator: 'CmdOrCtrl+/',
          click: showKeyboardShortcuts,
        },
        {
          type: 'separator',
        },
        {
          label: i18n('icu:contactUs'),
          click: openContactUs,
        },
        {
          label: i18n('icu:goToReleaseNotes'),
          click: openReleaseNotes,
        },
        {
          label: i18n('icu:goToForums'),
          click: openForums,
        },
        {
          label: i18n('icu:goToSupportPage'),
          click: openSupportPage,
        },
        ...(isProduction
          ? [
              {
                label: i18n('icu:joinTheBeta'),
                click: openJoinTheBeta,
              },
            ]
          : []),
        {
          type: 'separator',
        },
        {
          label: i18n('icu:aboutSignalDesktop'),
          click: showAbout,
        },
      ],
    },
  ];

  if (includeSetup) {
    const fileMenu = template[0];

    if (Array.isArray(fileMenu.submenu)) {
      // These are in reverse order, since we're prepending them one at a time
      if (options.development) {
        fileMenu.submenu.unshift({
          label: i18n('icu:menuSetupAsStandalone'),
          click: setupAsStandalone,
        });
      }

      fileMenu.submenu.unshift({
        type: 'separator',
      });
      fileMenu.submenu.unshift({
        label: i18n('icu:menuSetupAsNewDevice'),
        click: setupAsNewDevice,
      });
    } else {
      throw new Error('createTemplate: fileMenu.submenu was not an array!');
    }
  }

  if (platform === 'darwin') {
    return updateForMac(template, i18n, options);
  }

  return template;
};

function updateForMac(
  template: MenuListType,
  i18n: LocalizerType,
  options: CreateTemplateOptionsType
): MenuListType {
  const { showAbout, showSettings, showWindow } = options;

  // Remove About item and separator from Help menu, since they're in the app menu
  const aboutMenu = template[4];
  if (Array.isArray(aboutMenu.submenu)) {
    aboutMenu.submenu.pop();
    aboutMenu.submenu.pop();
  } else {
    throw new Error('updateForMac: help.submenu was not an array!');
  }

  // Remove preferences, separator, and quit from the File menu, since they're
  // in the app menu
  const fileMenu = template[0];
  if (Array.isArray(fileMenu.submenu)) {
    fileMenu.submenu.pop();
    fileMenu.submenu.pop();
    fileMenu.submenu.pop();
    // And insert "close".
    fileMenu.submenu.push(
      {
        type: 'separator',
      },
      {
        label: i18n('icu:windowMenuClose'),
        accelerator: 'CmdOrCtrl+W',
        role: 'close',
      }
    );
  } else {
    throw new Error('updateForMac: fileMenu.submenu was not an array!');
  }

  // Add the OSX-specific Signal Desktop menu at the far left
  template.unshift({
    label: i18n('icu:signalDesktop'),
    submenu: [
      {
        label: i18n('icu:aboutSignalDesktop'),
        click: showAbout,
      },
      {
        type: 'separator',
      },
      {
        label: i18n('icu:mainMenuSettings'),
        accelerator: 'CommandOrControl+,',
        click: showSettings,
      },
      {
        type: 'separator',
      },
      {
        label: i18n('icu:appMenuServices'),
        role: 'services',
      },
      {
        type: 'separator',
      },
      {
        label: i18n('icu:appMenuHide'),
        role: 'hide',
      },
      {
        label: i18n('icu:appMenuHideOthers'),
        role: 'hideOthers',
      },
      {
        label: i18n('icu:appMenuUnhide'),
        role: 'unhide',
      },
      {
        type: 'separator',
      },
      {
        label: i18n('icu:appMenuQuit'),
        role: 'quit',
      },
    ],
  });

  const editMenu = template[2];
  if (Array.isArray(editMenu.submenu)) {
    editMenu.submenu.push(
      {
        type: 'separator',
      },
      {
        label: i18n('icu:speech'),
        submenu: [
          {
            role: 'startSpeaking',
            label: i18n('icu:editMenuStartSpeaking'),
          },
          {
            role: 'stopSpeaking',
            label: i18n('icu:editMenuStopSpeaking'),
          },
        ],
      }
    );
  } else {
    throw new Error('updateForMac: edit.submenu was not an array!');
  }

  // Replace Window menu
  // eslint-disable-next-line no-param-reassign
  template[4].submenu = [
    {
      label: i18n('icu:windowMenuMinimize'),
      accelerator: 'CmdOrCtrl+M',
      role: 'minimize',
    },
    {
      label: i18n('icu:windowMenuZoom'),
      role: 'zoom',
    },
    {
      label: i18n('icu:show'),
      accelerator: 'CmdOrCtrl+Shift+0',
      click: showWindow,
    },
    {
      type: 'separator',
    },
    {
      role: 'front',
      label: i18n('icu:windowMenuBringAllToFront'),
    },
  ];

  return template;
}
