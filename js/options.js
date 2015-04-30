/* vim: ts=4:sw=4
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
;(function() {
    'use strict';
    $('.notifications .on button').click(function() {
        Whisper.Notifications.disable();
        initOptions();
    });

    $('.notifications .off button').click(function() {
        Whisper.Notifications.enable(initOptions);
        initOptions();
    });

    function initOptions() {
        if (Whisper.Notifications.isEnabled()) {
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
                $('.confirmation-dialog').hide();
                $('.progress-dialog').show();
                $('.progress-dialog .status').text('Generating Keys');
                resolve();
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
        var bg = extension.windows.getBackground();
        if (bg.textsecure.registration.isDone()) {
            $('#complete-number').text(bg.textsecure.storage.user.getNumber());
            $('#setup-complete').show().addClass('in');
            initOptions();
        } else {
            $('#init-setup').show().addClass('in');
            $('#status').text("Connecting...");

            var accountManager = new bg.textsecure.AccountManager();
            accountManager.registerSecondDevice(setProvisioningUrl, confirmNumber, incrementCounter).then(function() {
                $('.modal-container').hide();
                $('#init-setup').hide();
                $('#setup-complete').show().addClass('in');
                initOptions();
            });
        }
    });
})();
