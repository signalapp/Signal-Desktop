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
  class Reporter extends Mocha.reporters.HTML {
    constructor(runner, options) {
      super(runner, options);

      runner.on('pass', test => window.testUtilities.onTestEvent({
        type: 'pass',
        title: test.titlePath(),
      }));
      runner.on('fail', (test, error) => window.testUtilities.onTestEvent({
        type: 'fail',
        title: test.titlePath(),
        error: error?.stack || String(error),
      }));

      runner.on('end', () => window.testUtilities.onTestEvent({ type: 'end' }));
    }
  }

  mocha.reporter(Reporter);

  mocha.setup(window.testUtilities.setup);

  mocha.run();
})();

window.getPreferredSystemLocales = () => ['en'];
window.getLocaleOverride = () => null;
