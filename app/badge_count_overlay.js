// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const electron = require('electron');
const path = require('path');

const MAX_BADGE_COUNT = 9;

const createBadgeCountOverlay = getMainWindow => ({
  update: unreadCount => {
    const mainWindow = getMainWindow();
    if (!mainWindow) {
      return;
    }

    let unreadCountText = unreadCount ? `${unreadCount}` : '';
    let overlayIcon = null;

    if (unreadCount > 0) {
      if (unreadCount > MAX_BADGE_COUNT) {
        unreadCountText = `${MAX_BADGE_COUNT}plus`;
      }

      const overlayIconImagePath = path.join(
        __dirname,
        '..',
        'images',
        `badge_count_${unreadCountText}.png`
      );

      overlayIcon = electron.nativeImage.createFromPath(overlayIconImagePath);
    }

    mainWindow.setOverlayIcon(overlayIcon, unreadCountText);
  },
});

module.exports = createBadgeCountOverlay;
