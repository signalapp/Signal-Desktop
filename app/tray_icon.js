const path = require('path');

const fs = require('fs');
const { app, Menu, Tray } = require('electron');

let trayContextMenu = null;
let tray = null;

function createTrayIcon(getMainWindow, messages) {
  // A smaller icon is needed on macOS
  const iconSize = process.platform === 'darwin' ? '16' : '256';
  const iconNoNewMessages = path.join(
    __dirname,
    '..',
    'images',
    'session',
    `session_icon_${iconSize}.png`
  );

  tray = new Tray(iconNoNewMessages);

  tray.forceOnTop = mainWindow => {
    if (mainWindow) {
      // On some versions of GNOME the window may not be on top when restored.
      // This trick should fix it.
      // Thanks to: https://github.com/Enrico204/Whatsapp-Desktop/commit/6b0dc86b64e481b455f8fce9b4d797e86d000dc1
      mainWindow.setAlwaysOnTop(true);
      mainWindow.focus();
      mainWindow.setAlwaysOnTop(false);
    }
  };

  tray.toggleWindowVisibility = () => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();

        tray.forceOnTop(mainWindow);
      }
    }
    tray.updateContextMenu();
  };

  tray.showWindow = () => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      if (!mainWindow.isVisible()) {
        mainWindow.show();
      }

      tray.forceOnTop(mainWindow);
    }
    tray.updateContextMenu();
  };

  tray.updateContextMenu = () => {
    const mainWindow = getMainWindow();

    // NOTE: we want to have the show/hide entry available in the tray icon
    // context menu, since the 'click' event may not work on all platforms.
    // For details please refer to:
    // https://github.com/electron/electron/blob/master/docs/api/tray.md.
    trayContextMenu = Menu.buildFromTemplate([
      {
        id: 'toggleWindowVisibility',
        label:
          messages[mainWindow.isVisible() ? 'appMenuHide' : 'show'].message,
        click: tray.toggleWindowVisibility,
      },
      {
        id: 'quit',
        label: messages.appMenuQuit.message,
        click: app.quit.bind(app),
      },
    ]);

    tray.setContextMenu(trayContextMenu);
  };

  tray.updateIcon = unreadCount => {
    let image;

    if (unreadCount > 0) {
      const filename = `${String(unreadCount >= 10 ? 10 : unreadCount)}.png`;
      image = path.join(__dirname, '..', 'images', 'alert', iconSize, filename);
    } else {
      image = iconNoNewMessages;
    }

    if (!fs.existsSync(image)) {
      console.log('tray.updateIcon: Image for tray update does not exist!');
      return;
    }
    tray.setImage(image);
  };

  tray.on('click', tray.showWindow);

  tray.setToolTip(messages.sessionMessenger.message);
  tray.updateContextMenu();

  return tray;
}

module.exports = createTrayIcon;
