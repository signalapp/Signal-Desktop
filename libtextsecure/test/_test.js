mocha.setup("bdd");
window.assert = chai.assert;

(function() {
  var OriginalReporter = mocha._reporter;

  var SauceReporter = function(runner) {
    var failedTests = [];

    runner.on('end', function() {
      window.mochaResults = runner.stats;
      window.mochaResults.reports = failedTests;
    });

    runner.on('fail', function(test, err) {
      var flattenTitles = function(test) {
        var titles = [];
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
        titles: flattenTitles(test)
      });
    });

    new OriginalReporter(runner);
  };

  SauceReporter.prototype = OriginalReporter.prototype;

  mocha.reporter(SauceReporter);
}());

/*
 * global helpers for tests
 */
function assertEqualArrayBuffers(ab1, ab2) {
  assert.deepEqual(new Uint8Array(ab1), new Uint8Array(ab2));
};

function hexToArrayBuffer(str) {
  var ret = new ArrayBuffer(str.length / 2);
  var array = new Uint8Array(ret);
  for (var i = 0; i < str.length/2; i++)
    array[i] = parseInt(str.substr(i*2, 2), 16);
  return ret;
};

window.MockSocket.prototype.addEventListener = function() {};
