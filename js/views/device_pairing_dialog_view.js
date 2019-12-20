/* global
  Whisper,
  i18n,
  libloki,
  textsecure,
  ConversationController,
  $,
  QRCode,
*/

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.DevicePairingDialogView = Whisper.View.extend({
    className: 'loki-dialog device-pairing-dialog modal',
    templateName: 'device-pairing-dialog',
    initialize() {
      this.pubKeyRequests = [];
      this.reset();
      this.render();
      this.showView();
      this.qr = new QRCode(this.$('#qr')[0], {
        correctLevel: QRCode.CorrectLevel.L,
      });
      this.qr.makeCode(textsecure.storage.user.getNumber());
    },
    
    render() {
      this.dialogView = new Whisper.ReactWrapperView({
        className: 'device-pairing-dialog',
        Component: window.Signal.Components.DevicePairingDialog,
      });
    },
  });
})();
