/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';

    var LogEntry = Backbone.Model.extend({
        database: Whisper.Database,
        storeName: 'debug',
        printTime: function() {
            try {
                return new Date(this.get('time')).toISOString();
            } catch(e) {
                return '';
            }
        },
        printValue: function() {
            return this.get('value') || '';
        }
    });

    var DebugLog = Backbone.Collection.extend({
        database: Whisper.Database,
        storeName: 'debug',
        model: LogEntry,
        comparator: 'time',
        initialize: function() {
            this.fetch({remove: false});
        },
        log: function(str) {
            this.add({time: Date.now(), value: str}).save();
            while (this.length > MAX_MESSAGES) {
                this.at(0).destroy();
            }
        },
        print: function() {
            return this.map(function(entry) {
                return entry.printTime() + ' ' + entry.printValue();
            }).join('\n');
        }
    });

    var MAX_MESSAGES = 2000;
    var PHONE_REGEX = /\+\d{7,12}(\d{3})/g;
    var DEBUGLOGS_BASE_URL = 'https://debuglogs.org';
    var log = new DebugLog();
    if (window.console) {
        console._log = console.log;
        console.log = function() {
            console._log.apply(this, arguments);
            var args = Array.prototype.slice.call(arguments);
            var str = args.join(' ').replace(PHONE_REGEX, "+[REDACTED]$1");
            log.log(str);
        };
        console.get = function() {
            return window.navigator.userAgent +
                ' Signal-Desktop/' + chrome.runtime.getManifest().version +
                '\n' + log.print();
        };
        console.post = function(log) {
            if (log === undefined) {
                log = console.get();
            }

            return new Promise(function(resolve, reject) {
                // $.get(DEBUGLOGS_BASE_URL).then(function (signedForm) {

                    var signedForm = {
                      "url": "https://s3.amazonaws.com/signal-debug-logs",
                      "fields": {
                        "bucket": "signal-debug-logs",
                        "X-Amz-Algorithm": "...",
                        "X-Amz-Credential": "...",
                        "X-Amz-Date": "...",
                        "X-Amz-Security-Token": "...",
                        "Policy": "...",
                        "X-Amz-Signature": "...",
                        "key": "..."
                      }
                    };

                    var url = signedForm.url;
                    var fields = signedForm.fields;

                    var formData = new FormData();

                    // NOTE: Service expects `key` to come first:
                    formData.append('key', fields.key);
                    formData.append('Content-Type', 'text/plain');
                    for (var key in fields) {
                        if (key === 'key') {
                            continue;
                        }
                        var value = fields[key];
                        formData.append(key, value);
                    }

                    var contentBlob = new Blob([log], { type: 'text/plain' });
                    formData.append('file', contentBlob);

                    var publishedLogURL = DEBUGLOGS_BASE_URL + '/' + fields.key;

                    // jQuery 2.1.1-pre `FormData` upload results in this S3 error:
                    //
                    //   The body of your POST request is not well-formed
                    //   multipart/form-data.’
                    $.ajax({
                        method: 'POST',
                        url: url,
                        data: formData,
                        processData: false,
                        contentType: 'multipart/form-data',
                    }).then(function () {
                        resolve(publishedLogURL);
                    }).fail(function () {
                        reject();
                    });
                // });
            });
        };

        window.onerror = function(message, script, line, col, error) {
            console.log(error && error.stack ? error.stack : error);
        };
    }
})();
