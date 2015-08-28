/*
 * vim: ts=4:sw=4:expandtab
 */
;(function() {
    'use strict';
    extension.windows.getBackground(function(bg) {
        $('.notifications .on button').click(function() {
            bg.Whisper.Notifications.disable();
            initOptions();
        });

        $('.notifications .off button').click(function() {
            bg.Whisper.Notifications.enable(initOptions);
            initOptions();
        });

        function initOptions() {
            if (bg.Whisper.Notifications.isEnabled()) {
                $('.notifications .on').show();
                $('.notifications .off').hide();
            } else {
                $('.notifications .on').hide();
                $('.notifications .off').show();
            }
        }

        function setProvisioningUrl(url) {
            $('#status').text('');
            new QRCode($('#qr')[0]).makeCode(url);
        }

        function confirmNumber(number) {
            return new Promise(function(resolve, reject) {
                $('#qr').hide();
                $('.confirmation-dialog .number').text(number);
                $('.confirmation-dialog .cancel').click(function(e) {
                    localStorage.clear();
                    reject();
                });
                $('.confirmation-dialog .ok').click(function(e) {
                    e.stopPropagation();
                    var name = $('#device-name').val();
                    if (name.trim().length === 0) {
                        return;
                    }
                    $('.confirmation-dialog').hide();
                    $('.progress-dialog').show();
                    $('.progress-dialog .status').text('Generating Keys');
                    resolve(name);
                });
                $('.modal-container').show();
            });
        }

        var counter = 0;
        function incrementCounter() {
            $('.progress-dialog .bar').css('width', (++counter * 100 / 100) + '%');
        }

        $('.modal-container .cancel').click(function() {
            $('.modal-container').hide();
        });

        $(function() {
            $('#init-setup').show().addClass('in');
            $('#status').text("Connecting...");

            var accountManager = new bg.textsecure.AccountManager(bg.TEXT_SECURE_SERVER_URL);
            accountManager.registerSecondDevice(setProvisioningUrl, confirmNumber, incrementCounter).then(function() {
                var launch = function() {
                    bg.openInbox();
                    bg.removeEventListener('textsecure:contactsync', launch);
                    clearTimeout(timeout);
                    window.close();
                };
                var timeout = setTimeout(launch, 60000);
                bg.addEventListener('textsecure:contactsync', launch);
                $('.progress-dialog .status').text('Syncing groups and contacts');
                $('.progress-dialog .bar').addClass('progress-bar-striped active');

            }).catch(function(e) {
                if (e.name === 'HTTPError' && e.code == 411) {
                    $('.progress-dialog').hide();
                    $('.error-dialog').show();
                    $('.error-dialog .ok').click(function(e) {
                        chrome.runtime.reload();
                    });
                }
                else {
                    throw e;
                }
            });
        });
    });
})();
