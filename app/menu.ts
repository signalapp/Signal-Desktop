// Copyright 2017-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isString } from 'lodash';

import type { LocaleMessagesType } from '../ts/types/I18N';
import type {
  MenuListType,
  MenuOptionsType,
  MenuActionsType,
} from '../ts/types/menu';

export type CreateTemplateOptionsType = MenuOptionsType & MenuActionsType;

export const createTemplate = (
  options: CreateTemplateOptionsType,
  messages: LocaleMessagesType
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
      label: messages.mainMenuFile.message,
      submenu: [
        {
          label: messages.mainMenuCreateStickers.message,
          click: showStickerCreator,
        },
        {
          label: messages.mainMenuSettings.message,
          accelerator: 'CommandOrControl+,',
          click: showSettings,
        },
        {
          type: 'separator',
        },
        {
          role: 'quit',
          label: messages.appMenuQuit.message,
        },
      ],
    },
    {
      label: messages.mainMenuEdit.message,
      submenu: [
        {
          role: 'undo',
          label: messages.editMenuUndo.message,
        },
        {
          role: 'redo',
          label: messages.editMenuRedo.message,
        },
        {
          type: 'separator',
        },
        {
          role: 'cut',
          label: messages.editMenuCut.message,
        },
        {
          role: 'copy',
          label: messages.editMenuCopy.message,
        },
        {
          role: 'paste',
          label: messages.editMenuPaste.message,
        },
        {
          role: 'pasteAndMatchStyle',
          label: messages.editMenuPasteAndMatchStyle.message,
        },
        {
          role: 'delete',
          label: messages.editMenuDelete.message,
        },
        {
          role: 'selectAll',
          label: messages.editMenuSelectAll.message,
        },
      ],
    },
    {
      label: messages.mainMenuView.message,
      submenu: [
        {
          role: 'resetZoom',
          label: messages.viewMenuResetZoom.message,
        },
        {
          accelerator: 'CmdOrCtrl+=',
          role: 'zoomIn',
          label: messages.viewMenuZoomIn.message,
        },
        {
          role: 'zoomOut',
          label: messages.viewMenuZoomOut.message,
        },
        {
          type: 'separator',
        },
        {
          role: 'togglefullscreen',
          label: messages.viewMenuToggleFullScreen.message,
        },
        {
          type: 'separator',
        },
        {
          label: messages.debugLog.message,
          click: showDebugLog,
        },
        ...(devTools
          ? [
              {
                type: 'separator' as const,
              },
              {
                role: 'toggleDevTools' as const,
                label: messages.viewMenuToggleDevTools.message,
              },
            ]
          : []),
        ...(devTools && platform !== 'linux'
          ? [
              {
                label: messages.forceUpdate.message,
                click: forceUpdate,
              },
            ]
          : []),
      ],
    },
    {
      label: messages.mainMenuWindow.message,
      role: 'window',
      submenu: [
        {
          role: 'minimize',
          label: messages.windowMenuMinimize.message,
        },
      ],
    },
    {
      label: messages.mainMenuHelp.message,
      role: 'help',
      submenu: [
        {
          label: messages.helpMenuShowKeyboardShortcuts.message,
          accelerator: 'CmdOrCtrl+/',
          click: showKeyboardShortcuts,
        },
        {
          type: 'separator',
        },
        {
          label: messages.contactUs.message,
          click: openContactUs,
        },
        {
          label: messages.goToReleaseNotes.message,
          click: openReleaseNotes,
        },
        {
          label: messages.goToForums.message,
          click: openForums,
        },
        {
          label: messages.goToSupportPage.message,
          click: openSupportPage,
        },
        ...(isProduction
          ? [
              {
                label: messages.joinTheBeta.message,
                click: openJoinTheBeta,
              },
            ]
          : []),
        {
          type: 'separator',
        },
        {
          label: messages.aboutSignalDesktop.message,
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
          label: messages.menuSetupAsStandalone.message,
          click: setupAsStandalone,
        });
      }

      fileMenu.submenu.unshift({
        type: 'separator',
      });
      fileMenu.submenu.unshift({
        label: messages.menuSetupAsNewDevice.message,
        click: setupAsNewDevice,
      });
    } else {
      throw new Error('createTemplate: fileMenu.submenu was not an array!');
    }
  }

  if (platform === 'darwin') {
    return updateForMac(template, messages, options);
  }

  return template;
};

function updateForMac(
  template: MenuListType,
  messages: LocaleMessagesType,
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
        label: messages.windowMenuClose.message,
        accelerator: 'CmdOrCtrl+W',
        role: 'close',
      }
    );
  } else {
    throw new Error('updateForMac: fileMenu.submenu was not an array!');
  }

  // Add the OSX-specific Signal Desktop menu at the far left
  template.unshift({
    label: messages.signalDesktop.message,
    submenu: [
      {
        label: messages.aboutSignalDesktop.message,
        click: showAbout,
      },
      {
        type: 'separator',
      },
      {
        label: messages.mainMenuSettings.message,
        accelerator: 'CommandOrControl+,',
        click: showSettings,
      },
      {
        type: 'separator',
      },
      {
        label: messages.appMenuServices.message,
        role: 'services',
      },
      {
        type: 'separator',
      },
      {
        label: messages.appMenuHide.message,
        role: 'hide',
      },
      {
        label: messages.appMenuHideOthers.message,
        role: 'hideOthers',
      },
      {
        label: messages.appMenuUnhide.message,
        role: 'unhide',
      },
      {
        type: 'separator',
      },
      {
        label: messages.appMenuQuit.message,
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
        label: messages.speech.message,
        submenu: [
          {
            role: 'startSpeaking',
            label: messages.editMenuStartSpeaking.message,
          },
          {
            role: 'stopSpeaking',
            label: messages.editMenuStopSpeaking.message,
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
      label: messages.windowMenuMinimize.message,
      accelerator: 'CmdOrCtrl+M',
      role: 'minimize',
    },
    {
      label: messages.windowMenuZoom.message,
      role: 'zoom',
    },
    {
      label: messages.show.message,
      accelerator: 'CmdOrCtrl+Shift+0',
      click: showWindow,
    },
    {
      type: 'separator',
    },
    {
      role: 'front',
      label: messages.windowMenuBringAllToFront.message,
    },
  ];

  return template;
}
