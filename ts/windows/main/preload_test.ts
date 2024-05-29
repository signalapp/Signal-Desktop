// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable no-console */

import { ipcRenderer as ipc } from 'electron';
import { sync } from 'fast-glob';
import { inspect } from 'util';

// eslint-disable-next-line import/no-extraneous-dependencies
import { assert, config as chaiConfig } from 'chai';
// eslint-disable-next-line import/no-extraneous-dependencies
import { reporters } from 'mocha';

import { getSignalProtocolStore } from '../../SignalProtocolStore';
import { initMessageCleanup } from '../../services/messageStateCleanup';
import { initializeMessageCounter } from '../../util/incrementMessageCounter';
import { initializeRedux } from '../../state/initializeRedux';
import * as Stickers from '../../types/Stickers';
import { ThemeType } from '../../types/Util';

// Show actual objects instead of abbreviated errors
chaiConfig.truncateThreshold = 0;

function patchDeepEqual(method: 'deepEqual' | 'deepStrictEqual'): void {
  const originalFn = assert[method];
  assert[method] = (...args) => {
    try {
      return originalFn(...args);
    } catch (error) {
      reporters.base.useColors = false;
      error.message = reporters.base.generateDiff(
        inspect(error.actual, { depth: Infinity, sorted: true }),
        inspect(error.expected, { depth: Infinity, sorted: true })
      );
      throw error;
    }
  };
}

patchDeepEqual('deepEqual');
patchDeepEqual('deepStrictEqual');

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
      callLinks: [],
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
      theme: ThemeType.dark,
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
