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
            this.fetch({remove: false}).then(function() {
                console.log('Debug log: after fetch have', this.length, 'entries');
            }.bind(this));
        },
        log: function(str) {
            var entry = this.add({time: Date.now(), value: str});
            if (window.Whisper.Database.nolog) {
                entry.save();
            }

            // Two separate iterations to deal with removal eventing wonkiness
            var toDrop = this.length - MAX_MESSAGES;
            var entries = [];
            for (var i = 0; i < toDrop; i += 1) {
                entries.push(this.at(i));
            }
            this.remove(entries);
            for (var j = 0, max = entries.length; j < max; j += 1) {
                entries[j].destroy();
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
                ' node/' + window.config.node_version +
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
            console.log(error.stack);
        };
    }
})();
