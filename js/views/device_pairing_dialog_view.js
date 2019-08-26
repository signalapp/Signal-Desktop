/* global Whisper, i18n */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.DevicePairingDialogView = Whisper.View.extend({
    className: 'loki-dialog device-pairing-dialog modal',
    templateName: 'device-pairing-dialog',
    initialize() {
      this.pubKeyRequests = [];
      this.pubKey = null;
      this.accepted = false;
      this.view = '';
      this.render();
      this.showView();
    },
    events: {
      'click .waitingForRequestView .cancel': 'close',
      'click .requestReceivedView .skip': 'skipDevice',
      'click #allowPairing': 'allowDevice',
      'click .requestAcceptedView .ok': 'close',
    },
    render_attributes() {
      return {
        waitingForRequestTitle: 'Waiting for device to register...',
        requestReceivedTitle: 'Device Pairing Received',
        requestAcceptedTitle: 'Device Pairing Accepted',
        cancelText: i18n('cancel'),
        skipText: 'Skip',
        okText: i18n('ok'),
        allowPairingText: 'Allow Pairing',
      };
    },
    requestReceived(secondaryDevicePubKey) {
      // FIFO: push at the front of the array with unshift()
      this.pubKeyRequests.unshift(secondaryDevicePubKey);
      if (!this.pubKey) {
        this.nextPubKey();
        this.showView('requestReceived');
      }
    },
    allowDevice() {
      this.accepted = true;
      this.trigger('devicePairingRequestAccepted', this.pubKey, errors =>
        this.transmisssionCB(errors)
      );
      this.showView();
    },
    transmisssionCB(errors) {
      if (!errors) {
        this.$('.transmissionStatus').text('Sent successfully');
      } else {
        this.$('.transmissionStatus').text(errors);
      }
      this.$('.requestAcceptedView .ok').show();
    },
    skipDevice() {
      this.nextPubKey();
      this.showView();
    },
    nextPubKey() {
      // FIFO: pop at the back of the array using pop()
      this.pubKey = this.pubKeyRequests.pop();
    },
    showView() {
      const waitingForRequestView = this.$('.waitingForRequestView');
      const requestReceivedView = this.$('.requestReceivedView');
      const requestAcceptedView = this.$('.requestAcceptedView');
      if (this.accepted) {
        requestReceivedView.hide();
        waitingForRequestView.hide();
        requestAcceptedView.show();
      } else if (this.pubKey) {
        this.$('.secondaryPubKey').text(this.pubKey);
        requestReceivedView.show();
        waitingForRequestView.hide();
        requestAcceptedView.hide();
      } else {
        waitingForRequestView.show();
        requestReceivedView.hide();
        requestAcceptedView.hide();
      }
    },
    close() {
      this.remove();
    },
  });
})();
