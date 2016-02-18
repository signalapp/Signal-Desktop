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

    var MAX_MESSAGES = 1000;
    var PHONE_REGEX = /\+\d{7,12}(\d{3})/g;
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
            return new Promise(function(resolve) {
                $.post('https://api.github.com/gists', textsecure.utils.jsonThing({
                    "files": { "debugLog.txt": { "content": log } }
                })).then(function(response) {
                    console._log('Posted debug log to ', response.html_url);
                    resolve(response.html_url);
                }).fail(resolve);
            });
        };

        window.onerror = function(message, script, line, col, error) {
            console.log(error);
        };
    }
})();
