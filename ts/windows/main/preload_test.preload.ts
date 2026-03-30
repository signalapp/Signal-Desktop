// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { inspect, parseArgs } from 'node:util';
import { ipcRenderer as ipc } from 'electron';
import { sync } from 'fast-glob';

import chai, { assert, config as chaiConfig } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { reporters, type MochaOptions } from 'mocha';

import { initializeMessageCounter } from '../../util/incrementMessageCounter.preload.ts';
import { initializeRedux } from '../../state/initializeRedux.preload.ts';
import * as Stickers from '../../types/Stickers.preload.ts';
import { ThemeType } from '../../types/Util.std.ts';
import { itemStorage } from '../../textsecure/Storage.preload.ts';
import { MessageCache } from '../../services/MessageCache.preload.ts';
import { updateRemoteConfig } from '../../test-helpers/RemoteConfigStub.dom.ts';

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
    // Since background.preload.ts is not loaded in tests, we need to do some minimal
    // setup
    MessageCache.install();
    await updateRemoteConfig([]);
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
      megaphones: {
        visibleMegaphones: [],
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
        lastReturnToken: undefined,
        receipts: [],
        configCache: undefined,
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
    // oxlint-disable-next-line no-console
    console.log('Preparing tests...');
    const files = sync('../../test-{both,electron}/**/*_test.*.ts', {
      absolute: true,
      cwd: __dirname,
    });

    for (const [i, file] of files.entries()) {
      if (i % workerCount === worker) {
        try {
          // oxlint-disable-next-line import/no-dynamic-require, global-require
          require(file);
        } catch (error) {
          window.testUtilities.onTestEvent({
            type: 'fail',
            title: ['Failed to load test:', file],
            error: error.stack || String(error),
          });
        }
      }
    }
  },
};
