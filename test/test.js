// Copyright 2014 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* global Whisper, _, Backbone */

/*
 * global helpers for tests
 */

mocha.setup('bdd');
mocha.setup({ timeout: 10000 });

function deleteIndexedDB() {
  return new Promise((resolve, reject) => {
    const idbReq = indexedDB.deleteDatabase('test');
    idbReq.onsuccess = resolve;
    idbReq.error = reject;
  });
}

/* Delete the database before running any tests */
before(async () => {
  window.testUtilities.installMessageController();

  await deleteIndexedDB();
  try {
    window.SignalContext.log.info('Initializing SQL in renderer');
    const isTesting = true;
    await window.Signal.Data.startInRenderer(isTesting);
    window.SignalContext.log.info('SQL initialized in renderer');
  } catch (err) {
    window.SignalContext.log.error(
      'SQL failed to initialize',
      err && err.stack ? err.stack : err
    );
  }
  await window.testUtilities.initializeMessageCounter();
  await window.Signal.Data.removeAll();
  await window.storage.fetch();
});

window.textsecure.storage.protocol = window.getSignalProtocolStore();

window.testUtilities.prepareTests();
delete window.testUtilities.prepareTests;

!(function () {
  const passed = [];
  const failed = [];

  class Reporter extends Mocha.reporters.HTML {
    constructor(runner, options) {
      super(runner, options);

      runner.on('pass', test => passed.push(test.fullTitle()));
      runner.on('fail', (test, error) => {
        failed.push({
          testName: test.fullTitle(),
          error: error?.stack || String(error),
        });
      });

      runner.on('end', () =>
        window.testUtilities.onComplete({ passed, failed })
      );
    }
  }

  mocha.reporter(Reporter);

  mocha.run();
})();

window.getPreferredSystemLocales = () => ['en'];
