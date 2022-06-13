// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable no-console */

import { ipcRenderer as ipc } from 'electron';
import { sync } from 'fast-glob';

// eslint-disable-next-line import/no-extraneous-dependencies
import { assert } from 'chai';

window.assert = assert;

// This is a hack to let us run TypeScript tests in the renderer process. See the
//   code in `test/index.html`.

window.testUtilities = {
  onComplete(info) {
    return ipc.invoke('ci:test-electron:done', info);
  },
  prepareTests() {
    console.log('Preparing tests...');
    sync('../../test-{both,electron}/**/*_test.js', {
      absolute: true,
      cwd: __dirname,
    }).forEach(require);
  },
};
