mocha.setup('bdd');
window.assert = chai.assert;
window.PROTO_ROOT = '../protos';

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

// Override the database id.
window.Whisper          = window.Whisper          || {};
window.Whisper.Database = window.Whisper.Database || {};
Whisper.Database.id = 'test';

/*
 * global helpers for tests
 */
function assertEqualArrayBuffers(ab1, ab2) {
  assert.deepEqual(new Uint8Array(ab1), new Uint8Array(ab2));
};

function hexToArrayBuffer(str) {
  var ret = new ArrayBuffer(str.length / 2);
  var array = new Uint8Array(ret);
  for (var i = 0; i < str.length/2; i++) {
    array[i] = parseInt(str.substr(i*2, 2), 16);
  }
  return ret;
};

/* Delete the database before running any tests */
before(function(done) {
  var idbReq = indexedDB.deleteDatabase('test');
  idbReq.onsuccess = function() { done(); };
});

function clearDatabase(done) {
    var convos = new Whisper.ConversationCollection();
    return convos.fetch().then(function() {
        convos.destroyAll().then(function() {
            var messages = new Whisper.MessageCollection();
            return messages.fetch().then(function() {
                messages.destroyAll().then(function() {
                    if (done) {
                      done();
                    }
                });
            });
        });
    });
}
