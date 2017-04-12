/*
 * vim: ts=4:sw=4:expandtab
 */

;(function () {
    'use strict';
    window.Whisper = window.Whisper || {};
    var ROTATION_INTERVAL = 48 * 60 * 60 * 1000;
    var timeout;

    function scheduleNextRotation() {
        var now = Date.now();
        var nextTime = now + ROTATION_INTERVAL;
        storage.put('nextSignedKeyRotationTime', nextTime);
    }

    function run() {
        console.log('Rotating signed prekey...');
        getAccountManager().rotateSignedPreKey();
        scheduleNextRotation();
        setTimeoutForNextRun();
    }

    function runWhenOnline() {
        if (navigator.onLine) {
            run();
        } else {
            var listener = function() {
                window.removeEventListener('online', listener);
                run();
            };
            window.addEventListener('online', listener);
        }
    }

    function setTimeoutForNextRun() {
        var now = Date.now();
        var scheduledTime = storage.get('nextSignedKeyRotationTime', now);
        console.log('Next signed key rotation scheduled for', new Date(scheduledTime));
        var waitTime = scheduledTime - now;
        if (waitTime < 0) {
            waitTime = 0;
        }
        clearTimeout(timeout);
        timeout = setTimeout(runWhenOnline, waitTime);
    }

    Whisper.RotateSignedPreKeyListener = {
        init: function(events) {
            if (Whisper.Registration.isDone()) {
                setTimeoutForNextRun();
            }
            events.on('registration_done', function() {
                scheduleNextRotation();
                setTimeoutForNextRun();
            });
            events.on('timetravel', function() {
                if (Whisper.Registration.isDone()) {
                    setTimeoutForNextRun();
                }
            });
        }
    };
}());
