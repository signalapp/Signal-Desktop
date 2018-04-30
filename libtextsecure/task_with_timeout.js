(function () {
    window.textsecure = window.textsecure || {};

    window.textsecure.createTaskWithTimeout = function(task, id, options) {
        options = options || {};
        options.timeout = options.timeout || (1000 * 60 * 2); // two minutes

        var errorForStack = new Error('for stack');
        return function() {
            return new Promise(function(resolve, reject) {
                var complete = false;
                var timer = setTimeout(function() {
                    if (!complete) {
                        var message =
                            (id || '')
                            + ' task did not complete in time. Calling stack: '
                            + errorForStack.stack;

                        console.log(message);
                        return reject(new Error(message));
                    }
                }.bind(this), options.timeout);
                var clearTimer = function() {
                    try {
                        var localTimer = timer;
                        if (localTimer) {
                            timer = null;
                            clearTimeout(localTimer);
                        }
                    }
                    catch (error) {
                        console.log(
                            id || '',
                            'task ran into problem canceling timer. Calling stack:',
                            errorForStack.stack
                        );
                    }
                };

                var success = function(result) {
                    clearTimer();
                    complete = true;
                    return resolve(result);
                };
                var failure = function(error) {
                    clearTimer();
                    complete = true;
                    return reject(error);
                };

                var promise;
                try {
                    promise = task();
                } catch(error) {
                    clearTimer();
                    throw error;
                }
                if (!promise || !promise.then) {
                    clearTimer();
                    complete = true;
                    return resolve(promise);
                }

                return promise.then(success, failure);
            });
        };
    };
})();
