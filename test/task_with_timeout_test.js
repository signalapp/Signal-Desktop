'use strict';

describe('TaskWithTimeout', function() {
    describe('createTaskWithTimeout', function() {
        it('resolves when promise resolves', function() {
          var task = function() {
            return Promise.resolve();
          };
          var taskWithTimeout = Whisper.createTaskWithTimeout(task);

          return taskWithTimeout();
        });
        it('flows error from promise back', function() {
          var error = new Error('original');
          var task = function() {
            return Promise.reject(error);
          };
          var taskWithTimeout = Whisper.createTaskWithTimeout(task);

          return taskWithTimeout().catch(function(flowedError) {
            assert.strictEqual(error, flowedError);
          });
        });
        it('resolves if promise takes too long', function() {
          var error = new Error('original');
          var complete = false;
          var task = function() {
            return new Promise(function(resolve) {
              setTimeout(function() {
                completed = true;
                resolve();
              }, 3000);
            });
          };
          var taskWithTimeout = Whisper.createTaskWithTimeout(task, this.name, {
            timeout: 10
          });

          return taskWithTimeout().then(function() {
            assert.strictEqual(complete, false);
          });
        });
        it('resolves if task returns something falsey', function() {
          var task = function() {};
          var taskWithTimeout = Whisper.createTaskWithTimeout(task);
          return taskWithTimeout();
        });
        it('resolves if task returns a non-promise', function() {
          var task = function() {
            return 'hi!';
          };
          var taskWithTimeout = Whisper.createTaskWithTimeout(task);
          return taskWithTimeout();
        });
    });
});
