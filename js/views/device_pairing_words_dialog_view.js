/* global Whisper, i18n, textsecure */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.DevicePairingWordsDialogView = Whisper.View.extend({
    className: 'loki-dialog device-pairing-words-dialog modal',
    templateName: 'device-pairing-words-dialog',
    initialize() {
      const pubKey = textsecure.storage.user.getNumber();
      this.secretWords = window.mnemonic
        .mn_encode(pubKey.slice(2), 'english')
        .split(' ')
        .slice(-3)
        .join(' ');
      this.render();
    },
    events: {
      'click #close': 'close',
    },
    render_attributes() {
      return {
        title: i18n('showPairingWordsTitle'),
        closeText: i18n('close'),
        secretWords: this.secretWords,
      };
    },
    close() {
      this.remove();
    },
  });
})();
