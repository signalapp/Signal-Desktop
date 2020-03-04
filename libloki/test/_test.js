/* global window, mocha, chai, assert, Whisper */

mocha
  .setup('bdd')
  .fullTrace()
  .timeout(10000);
window.assert = chai.assert;
window.PROTO_ROOT = '../../protos';

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

// Override the database id.
window.Whisper = window.Whisper || {};
window.Whisper.Database = window.Whisper.Database || {};
Whisper.Database.id = 'test';

/*
 * global helpers for tests
 */
window.clearDatabase = async () => {
  await window.Signal.Data.removeAll();
};
