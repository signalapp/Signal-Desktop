// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable no-console */

import { inspect, parseArgs } from 'node:util';
import { ipcRenderer as ipc } from 'electron';
import { sync } from 'fast-glob';

// eslint-disable-next-line import/no-extraneous-dependencies
import chai, { assert, config as chaiConfig } from 'chai';
// eslint-disable-next-line import/no-extraneous-dependencies
import chaiAsPromised from 'chai-as-promised';
// eslint-disable-next-line import/no-extraneous-dependencies
import { reporters, type MochaOptions } from 'mocha';

import { initMessageCleanup } from '../../services/messageStateCleanup.preload.js';
import { initializeMessageCounter } from '../../util/incrementMessageCounter.preload.js';
import { initializeRedux } from '../../state/initializeRedux.preload.js';
import * as Stickers from '../../types/Stickers.preload.js';
import { ThemeType } from '../../types/Util.std.js';
import { itemStorage } from '../../textsecure/Storage.preload.js';

chai.use(chaiAsPromised);

// Show actual objects instead of abbreviated errors
chaiConfig.truncateThreshold = 0;

function patchDeepEqual(method: 'deepEqual' | 'deepStrictEqual'): void {
  const originalFn = assert[method];
  assert[method] = (...args) => {
    try {
      return originalFn(...args);
    } catch (error) {
      reporters.base.useColors = false;
      (reporters.base as unknown as { maxDiffSize: number }).maxDiffSize = 0;
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

const setup: MochaOptions = {};
let worker = 0;
let workerCount = 1;

{
  const { values } = parseArgs({
    args: ipc.sendSync('ci:test-electron:getArgv'),
    options: {
      grep: {
        type: 'string',
      },
      worker: {
        type: 'string',
      },
      'worker-count': {
        type: 'string',
      },
    },
    strict: false,
  });

  if (typeof values.grep === 'string') {
    setup.grep = values.grep;
  }
  if (typeof values.worker === 'string') {
    worker = parseInt(values.worker, 10);
  }
  if (typeof values['worker-count'] === 'string') {
    workerCount = parseInt(values['worker-count'], 10);
  }
}

window.testUtilities = {
  setup,

  onTestEvent(event: unknown) {
    return ipc.invoke('ci:test-electron:event', event);
  },

  debug(info) {
    return ipc.invoke('ci:test-electron:debug', info);
  },

  async initialize() {
    initMessageCleanup();
    await initializeMessageCounter();
    await Stickers.load();

    initializeRedux({
      badgesState: { byId: {} },
      callLinks: [],
      callHistory: [],
      callHistoryUnreadCount: 0,
      chatFolders: [],
      gifs: {
        recentGifs: [],
      },
      mainWindowStats: {
        isFullScreen: false,
        isMaximized: false,
      },
      menuOptions: {
        development: false,
        devTools: false,
        includeSetup: false,
        isNightly: false,
        isProduction: false,
        platform: 'test',
      },
      notificationProfiles: [],
      recentEmoji: {
        recents: [],
      },
      stories: [],
      storyDistributionLists: [],
      donations: {
        currentWorkflow: undefined,
        didResumeWorkflowAtStartup: false,
        lastError: undefined,
        receipts: [],
      },
      stickers: {
        installedPack: null,
        packs: {},
        recentStickers: [],
        blessedPacks: {},
      },
      theme: ThemeType.dark,
    });

    await itemStorage.fetch();
  },

  prepareTests() {
    console.log('Preparing tests...');
    const files = sync('../../test-{both,electron}/**/*_test.*.js', {
      absolute: true,
      cwd: __dirname,
    });

    for (let i = 0; i < files.length; i += 1) {
      if (i % workerCount === worker) {
        try {
          // eslint-disable-next-line import/no-dynamic-require, global-require
          require(files[i]);
        } catch (error) {
          window.testUtilities.onTestEvent({
            type: 'fail',
            title: ['Failed to load test:', files[i]],
            error: error.stack || String(error),
          });
        }
      }
    }
  },
};
