const { app } = require('electron');

const dockIcon = {};

dockIcon.show = () => {
  if (process.platform === 'darwin') {
    app.dock.show();
  }
};

dockIcon.hide = () => {
  if (process.platform === 'darwin') {
    app.dock.hide();
  }
};

module.exports = dockIcon;
