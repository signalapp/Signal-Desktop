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
    showKeyboardShortcuts,
    showSettings,
    showStickerCreator,
  } = options;

  const template: MenuListType = [
    {
      label: i18n('mainMenuFile'),
      submenu: [
        {
          label: i18n('mainMenuCreateStickers'),
          click: showStickerCreator,
        },
        {
          label: i18n('mainMenuSettings'),
          accelerator: 'CommandOrControl+,',
          click: showSettings,
        },
        {
          type: 'separator',
        },
        {
          role: 'quit',
          label: i18n('appMenuQuit'),
        },
      ],
    },
    {
      label: i18n('mainMenuEdit'),
      submenu: [
        {
          role: 'undo',
          label: i18n('editMenuUndo'),
        },
        {
          role: 'redo',
          label: i18n('editMenuRedo'),
        },
        {
          type: 'separator',
        },
        {
          role: 'cut',
          label: i18n('editMenuCut'),
        },
        {
          role: 'copy',
          label: i18n('editMenuCopy'),
        },
        {
          role: 'paste',
          label: i18n('editMenuPaste'),
        },
        {
          role: 'pasteAndMatchStyle',
          label: i18n('editMenuPasteAndMatchStyle'),
        },
        {
          role: 'delete',
          label: i18n('editMenuDelete'),
        },
        {
          role: 'selectAll',
          label: i18n('editMenuSelectAll'),
        },
      ],
    },
    {
      label: i18n('mainMenuView'),
      submenu: [
        {
          role: 'resetZoom',
          label: i18n('viewMenuResetZoom'),
        },
        {
          accelerator: 'CmdOrCtrl+=',
          role: 'zoomIn',
          label: i18n('viewMenuZoomIn'),
        },
        {
          role: 'zoomOut',
          label: i18n('viewMenuZoomOut'),
        },
        {
          type: 'separator',
        },
        {
          role: 'togglefullscreen',
          label: i18n('viewMenuToggleFullScreen'),
        },
        {
          type: 'separator',
        },
        {
          label: i18n('debugLog'),
          click: showDebugLog,
        },
        ...(devTools
          ? [
              {
                type: 'separator' as const,
              },
              {
                role: 'toggleDevTools' as const,
                label: i18n('viewMenuToggleDevTools'),
              },
            ]
          : []),
        ...(devTools && platform !== 'linux'
          ? [
              {
                label: i18n('forceUpdate'),
                click: forceUpdate,
              },
            ]
          : []),
      ],
    },
    {
      label: i18n('mainMenuWindow'),
      role: 'window',
      submenu: [
        {
          role: 'minimize',
          label: i18n('windowMenuMinimize'),
        },
      ],
    },
    {
      label: i18n('mainMenuHelp'),
      role: 'help',
      submenu: [
        {
          label: i18n('helpMenuShowKeyboardShortcuts'),
          accelerator: 'CmdOrCtrl+/',
          click: showKeyboardShortcuts,
        },
        {
          type: 'separator',
        },
        {
          label: i18n('contactUs'),
          click: openContactUs,
        },
        {
          label: i18n('goToReleaseNotes'),
          click: openReleaseNotes,
        },
        {
          label: i18n('goToForums'),
          click: openForums,
        },
        {
          label: i18n('goToSupportPage'),
          click: openSupportPage,
        },
        ...(isProduction
          ? [
              {
                label: i18n('joinTheBeta'),
                click: openJoinTheBeta,
              },
            ]
          : []),
        {
          type: 'separator',
        },
        {
          label: i18n('aboutSignalDesktop'),
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
          label: i18n('menuSetupAsStandalone'),
          click: setupAsStandalone,
        });
      }

      fileMenu.submenu.unshift({
        type: 'separator',
      });
      fileMenu.submenu.unshift({
        label: i18n('menuSetupAsNewDevice'),
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
        label: i18n('windowMenuClose'),
        accelerator: 'CmdOrCtrl+W',
        role: 'close',
      }
    );
  } else {
    throw new Error('updateForMac: fileMenu.submenu was not an array!');
  }

  // Add the OSX-specific Signal Desktop menu at the far left
  template.unshift({
    label: i18n('signalDesktop'),
    submenu: [
      {
        label: i18n('aboutSignalDesktop'),
        click: showAbout,
      },
      {
        type: 'separator',
      },
      {
        label: i18n('mainMenuSettings'),
        accelerator: 'CommandOrControl+,',
        click: showSettings,
      },
      {
        type: 'separator',
      },
      {
        label: i18n('appMenuServices'),
        role: 'services',
      },
      {
        type: 'separator',
      },
      {
        label: i18n('appMenuHide'),
        role: 'hide',
      },
      {
        label: i18n('appMenuHideOthers'),
        role: 'hideOthers',
      },
      {
        label: i18n('appMenuUnhide'),
        role: 'unhide',
      },
      {
        type: 'separator',
      },
      {
        label: i18n('appMenuQuit'),
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
        label: i18n('speech'),
        submenu: [
          {
            role: 'startSpeaking',
            label: i18n('editMenuStartSpeaking'),
          },
          {
            role: 'stopSpeaking',
            label: i18n('editMenuStopSpeaking'),
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
      label: i18n('windowMenuMinimize'),
      accelerator: 'CmdOrCtrl+M',
      role: 'minimize',
    },
    {
      label: i18n('windowMenuZoom'),
      role: 'zoom',
    },
    {
      label: i18n('show'),
      accelerator: 'CmdOrCtrl+Shift+0',
      click: showWindow,
    },
    {
      type: 'separator',
    },
    {
      role: 'front',
      label: i18n('windowMenuBringAllToFront'),
    },
  ];

  return template;
}
