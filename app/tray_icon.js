const path = require('path');

const { app, Menu, Tray } = require('electron');

let trayContextMenu = null;
let tray = null;

function createTrayIcon(getMainWindow, messages) {
  // keep the duplicated part to allow for search and find
  const iconFile = process.platform === 'darwin' ? 'session_icon_16.png' : 'session_icon.png';
  const iconNoNewMessages = path.join(__dirname, '..', 'images', 'session', iconFile);
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
        label: messages[mainWindow.isVisible() ? 'appMenuHide' : 'show'],
        click: tray.toggleWindowVisibility,
      },
      {
        id: 'quit',
        label: messages.appMenuQuit,
        click: app.quit.bind(app),
      },
    ]);

    tray.setContextMenu(trayContextMenu);
  };

  tray.on('click', tray.showWindow);

  tray.setToolTip(messages.sessionMessenger);
  tray.updateContextMenu();

  return tray;
}

module.exports = createTrayIcon;
