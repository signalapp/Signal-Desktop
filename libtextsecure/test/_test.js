mocha.setup('bdd');
window.assert = chai.assert;
window.PROTO_ROOT = '../../protos';

(function() {
  const OriginalReporter = mocha._reporter;

  const SauceReporter = function(runner) {
    const failedTests = [];

    runner.on('end', () => {
      window.mochaResults = runner.stats;
      window.mochaResults.reports = failedTests;
    });

    runner.on('fail', (test, err) => {
      const flattenTitles = function(test) {
        const titles = [];
        while (test.parent.title) {
          titles.push(test.parent.title);
          test = test.parent;
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

    new OriginalReporter(runner);
  };

  SauceReporter.prototype = OriginalReporter.prototype;

  mocha.reporter(SauceReporter);
})();

/*
 * global helpers for tests
 */
function assertEqualArrayBuffers(ab1, ab2) {
  assert.deepEqual(new Uint8Array(ab1), new Uint8Array(ab2));
}

function hexToArrayBuffer(str) {
  const ret = new ArrayBuffer(str.length / 2);
  const array = new Uint8Array(ret);
  for (let i = 0; i < str.length / 2; i++)
    array[i] = parseInt(str.substr(i * 2, 2), 16);
  return ret;
}

window.MockSocket.prototype.addEventListener = function() {};
