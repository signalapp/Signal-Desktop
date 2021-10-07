// Copyright 2015-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* global chai */

mocha.setup('bdd');
window.assert = chai.assert;

const OriginalReporter = mocha._reporter;

const SauceReporter = function Constructor(runner) {
  const failedTests = [];

  runner.on('end', () => {
    window.mochaResults = runner.stats;
    window.mochaResults.reports = failedTests;
  });

  runner.on('fail', (test, err) => {
    const flattenTitles = item => {
      const titles = [];
      while (item.parent.title) {
        titles.push(item.parent.title);
        // eslint-disable-next-line no-param-reassign
        item = item.parent;
      }
      return titles.reverse();
    };
    failedTests.push({
      name: test.title,
      result: false,
      message: err.message,
      stack: err.stack,
      titles: flattenTitles(test),
    });
  });

  // eslint-disable-next-line no-new
  new OriginalReporter(runner);
};

SauceReporter.prototype = OriginalReporter.prototype;

mocha.reporter(SauceReporter);

/*
 * global helpers for tests
 */

window.Whisper = window.Whisper || {};
window.Whisper.events = {
  on() {},
  trigger() {},
};

before(async () => {
  try {
    window.SignalWindow.log.info('Initializing SQL in renderer');
    const isTesting = true;
    await window.sqlInitializer.initialize(isTesting);
    window.SignalWindow.log.info('SQL initialized in renderer');
  } catch (err) {
    window.SignalWindow.log.error(
      'SQL failed to initialize',
      err && err.stack ? err.stack : err
    );
  }

  await window.Signal.Util.initializeMessageCounter();
});
