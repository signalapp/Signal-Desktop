// Copyright 2017-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { join } from 'path';
import { existsSync } from 'fs';

import { BrowserWindow, app, Menu, Tray } from 'electron';
import * as DockIcon from '../ts/dock_icon';

import { LocaleMessagesType } from '../ts/types/I18N';

let trayContextMenu = null;
let tray: Tray | undefined;

export default function createTrayIcon(
  getMainWindow: () => BrowserWindow | undefined,
  messages: LocaleMessagesType
): { updateContextMenu: () => void; updateIcon: (count: number) => void } {
  let iconSize: string;
  switch (process.platform) {
    case 'darwin':
      iconSize = '16';
      break;
    case 'win32':
      iconSize = '32';
      break;
    default:
      iconSize = '256';
      break;
  }

  const iconNoNewMessages = join(
    __dirname,
    '..',
    'images',
    `icon_${iconSize}.png`
  );

  tray = new Tray(iconNoNewMessages);

  const forceOnTop = (mainWindow: BrowserWindow) => {
    if (mainWindow) {
      // On some versions of GNOME the window may not be on top when restored.
      // This trick should fix it.
      // Thanks to: https://github.com/Enrico204/Whatsapp-Desktop/commit/6b0dc86b64e481b455f8fce9b4d797e86d000dc1
      mainWindow.setAlwaysOnTop(true);
      mainWindow.focus();
      mainWindow.setAlwaysOnTop(false);
    }
  };

  const toggleWindowVisibility = () => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
        DockIcon.hide();
      } else {
        mainWindow.show();
        DockIcon.show();

        forceOnTop(mainWindow);
      }
    }
    updateContextMenu();
  };

  const showWindow = () => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      if (!mainWindow.isVisible()) {
        mainWindow.show();
      }

      forceOnTop(mainWindow);
    }
    updateContextMenu();
  };

  const updateContextMenu = () => {
    const mainWindow = getMainWindow();

    // NOTE: we want to have the show/hide entry available in the tray icon
    // context menu, since the 'click' event may not work on all platforms.
    // For details please refer to:
    // https://github.com/electron/electron/blob/master/docs/api/tray.md.
    trayContextMenu = Menu.buildFromTemplate([
      {
        id: 'toggleWindowVisibility',
        label:
          messages[mainWindow && mainWindow.isVisible() ? 'hide' : 'show']
            .message,
        click: toggleWindowVisibility,
      },
      {
        id: 'quit',
        label: messages.quit.message,
        click: app.quit.bind(app),
      },
    ]);

    tray?.setContextMenu(trayContextMenu);
  };

  const updateIcon = (unreadCount: number) => {
    let image;

    if (unreadCount > 0) {
      const filename = `${String(unreadCount >= 10 ? 10 : unreadCount)}.png`;
      image = join(__dirname, '..', 'images', 'alert', iconSize, filename);
    } else {
      image = iconNoNewMessages;
    }

    if (!existsSync(image)) {
      console.log('tray.updateIcon: Image for tray update does not exist!');
      return;
    }
    try {
      tray?.setImage(image);
    } catch (error) {
      console.log(
        'tray.setImage error:',
        error && error.stack ? error.stack : error
      );
    }
  };

  tray.on('click', showWindow);

  tray.setToolTip(messages.signalDesktop.message);
  updateContextMenu();

  return {
    updateContextMenu,
    updateIcon,
  };
}
