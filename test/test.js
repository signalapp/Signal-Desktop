// Copyright 2014 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

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

window.Events = {
  getThemeSetting: () => 'light',
};

/* Delete the database before running any tests */
before(async () => {
  await window.testUtilities.initialize();
  await deleteIndexedDB();
  await window.Signal.Data.removeAll();
  await window.storage.fetch();
});

window.testUtilities.prepareTests();
delete window.testUtilities.prepareTests;
window.textsecure.storage.protocol = window.getSignalProtocolStore();

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
window.getLocaleOverride = () => null;
