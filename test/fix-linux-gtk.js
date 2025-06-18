// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const { app } = require('electron');

if (process.platform === 'linux') {
  // eslint-disable-next-line no-console
  console.log('Applying electron switch for Linux GTK version --gtk-version=3');
  // https://github.com/electron/electron/issues/46538#issuecomment-2808806722
  app.commandLine.appendSwitch('gtk-version', '3');
}
