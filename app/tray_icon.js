const path = require('path');

const {
  app,
  Menu,
  Tray,
} = require('electron');

let trayContextMenu = null;
let tray = null;

function createTrayIcon(getMainWindow, messages) {
  // A smaller icon is needed on macOS
  tray = new Tray(
    process.platform === 'darwin' ?
      path.join(__dirname, '..', 'images', 'icon_16.png') :
      path.join(__dirname, '..', 'images', 'icon_256.png'),
  );

  tray.toggleWindowVisibility = () => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();

        // On some versions of GNOME the window may not be on top when restored.
        // This trick should fix it.
        // Thanks to: https://github.com/Enrico204/Whatsapp-Desktop/commit/6b0dc86b64e481b455f8fce9b4d797e86d000dc1
        mainWindow.setAlwaysOnTop(true);
        mainWindow.focus();
        mainWindow.setAlwaysOnTop(false);
      }
    }
    tray.updateContextMenu();
  };

  tray.updateContextMenu = () => {
    const mainWindow = getMainWindow();

    // NOTE: we want to have the show/hide entry available in the tray icon
    // context menu, since the 'click' event may not work on all platforms.
    // For details please refer to:
    // https://github.com/electron/electron/blob/master/docs/api/tray.md.
    trayContextMenu = Menu.buildFromTemplate([{
      id: 'toggleWindowVisibility',
      label: messages[mainWindow.isVisible() ? 'hide' : 'show'].message,
      click: tray.toggleWindowVisibility,
    },
    {
      id: 'quit',
      label: messages.quit.message,
      click: app.quit.bind(app),
    }]);

    tray.setContextMenu(trayContextMenu);
  };

  tray.on('click', tray.toggleWindowVisibility);

  tray.setToolTip(messages.trayTooltip.message);
  tray.updateContextMenu();

  return tray;
}

module.exports = createTrayIcon;
