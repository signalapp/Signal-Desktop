/*
 * vim: ts=4:sw=4:expandtab
 */

;(function () {
    'use strict';
    window.Whisper = window.Whisper || {};
    var ROTATION_INTERVAL = 48 * 60 * 60 * 1000;
    var timeout;
    var scheduledTime;

    function scheduleNextRotation() {
        var now = Date.now();
        var nextTime = now + ROTATION_INTERVAL;
        storage.put('nextSignedKeyRotationTime', nextTime);
    }

    function run() {
        console.log('Rotating signed prekey...');
        getAccountManager().rotateSignedPreKey().catch(function() {
            console.log('rotateSignedPrekey() failed. Trying again in five seconds');
            setTimeout(runWhenOnline, 5000);
        });
        scheduleNextRotation();
        setTimeoutForNextRun();
    }

    function runWhenOnline() {
        if (navigator.onLine) {
            run();
        } else {
            console.log('We are offline; keys will be rotated when we are next online');
            var listener = function() {
                window.removeEventListener('online', listener);
                run();
            };
            window.addEventListener('online', listener);
        }
    }

    function setTimeoutForNextRun() {
        var now = Date.now();
        var time = storage.get('nextSignedKeyRotationTime', now);

        if (scheduledTime !== time || !timeout) {
            console.log('Next signed key rotation scheduled for', new Date(time));
        }

        scheduledTime = time;
        var waitTime = time - now;
        if (waitTime < 0) {
            waitTime = 0;
        }

        clearTimeout(timeout);
        timeout = setTimeout(runWhenOnline, waitTime);
    }

    var initComplete;
    Whisper.RotateSignedPreKeyListener = {
        init: function(events, newVersion) {
            if (initComplete) {
                console.log('Rotate signed prekey listener: Already initialized');
                return;
            }
            initComplete = true;

            if (newVersion) {
                runWhenOnline();
            } else {
                setTimeoutForNextRun();
            }

            events.on('timetravel', function() {
                if (Whisper.Registration.isDone()) {
                    setTimeoutForNextRun();
                }
            });
        }
    };
}());
