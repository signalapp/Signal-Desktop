// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable no-console */

import { ipcRenderer as ipc } from 'electron';
import { sync } from 'fast-glob';

// eslint-disable-next-line import/no-extraneous-dependencies
import { assert } from 'chai';

import { getSignalProtocolStore } from '../../SignalProtocolStore';
import { initMessageCleanup } from '../../services/messageStateCleanup';
import { initializeMessageCounter } from '../../util/incrementMessageCounter';
import { initializeRedux } from '../../state/initializeRedux';
import * as Stickers from '../../types/Stickers';

window.assert = assert;

// This is a hack to let us run TypeScript tests in the renderer process. See the
//   code in `test/test.js`.

window.testUtilities = {
  debug(info) {
    return ipc.invoke('ci:test-electron:debug', info);
  },

  onComplete(info) {
    return ipc.invoke('ci:test-electron:done', info);
  },

  async initialize() {
    initMessageCleanup();
    await initializeMessageCounter();
    await Stickers.load();

    initializeRedux({
      callsHistory: [],
      callsHistoryUnreadCount: 0,
      initialBadgesState: { byId: {} },
      mainWindowStats: {
        isFullScreen: false,
        isMaximized: false,
      },
      menuOptions: {
        development: false,
        devTools: false,
        includeSetup: false,
        isProduction: false,
        platform: 'test',
      },
      stories: [],
      storyDistributionLists: [],
    });
  },

  prepareTests() {
    console.log('Preparing tests...');
    sync('../../test-{both,electron}/**/*_test.js', {
      absolute: true,
      cwd: __dirname,
    }).forEach(require);
  },
};

window.getSignalProtocolStore = getSignalProtocolStore;
