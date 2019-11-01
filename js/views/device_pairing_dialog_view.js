/* global Whisper, i18n, libloki, textsecure, ConversationController */

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
    },
    reset() {
      this.pubKey = null;
      this.accepted = false;
      this.isListening = false;
      this.success = false;
    },
    events: {
      'click #startPairing': 'startReceivingRequests',
      'click #close': 'close',
      'click .waitingForRequestView .cancel': 'stopReceivingRequests',
      'click .requestReceivedView .skip': 'skipDevice',
      'click #allowPairing': 'allowDevice',
      'click .requestAcceptedView .ok': 'stopReceivingRequests',
    },
    render_attributes() {
      return {
        defaultTitle: i18n('pairedDevices'),
        waitingForRequestTitle: i18n('waitingForDeviceToRegister'),
        requestReceivedTitle: i18n('devicePairingReceived'),
        requestAcceptedTitle: i18n('devicePairingAccepted'),
        startPairingText: i18n('pairNewDevice'),
        cancelText: i18n('cancel'),
        closeText: i18n('close'),
        skipText: i18n('skip'),
        okText: i18n('ok'),
        allowPairingText: i18n('allowPairing'),
      };
    },
    startReceivingRequests() {
      this.trigger('startReceivingRequests');
      this.isListening = true;
      this.showView();
    },
    stopReceivingRequests() {
      if (this.success) {
        const deviceAlias = this.$('#deviceAlias')[0].value.trim();
        const conv = ConversationController.get(this.pubKey);
        if (conv) {
          conv.setNickname(deviceAlias);
        }
      }
      this.trigger('stopReceivingRequests');
      this.reset();
      this.showView();
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
        this.$('.transmissionStatus').text(i18n('provideDeviceAlias'));
        this.$('#deviceAliasView').show();
        this.$('#deviceAlias').on('keydown', (e) => {
          if (e.target.value.trim()) {
            this.$('.requestAcceptedView .ok').removeAttr('disabled');
          } else {
            this.$('.requestAcceptedView .ok').attr('disabled', true);
          }
        });
        this.$('.requestAcceptedView .ok').show();
        this.$('.requestAcceptedView .ok').attr('disabled', true);
        this.success = true;
      } else {
        this.$('.transmissionStatus').text(errors);
        this.$('.requestAcceptedView .ok').show();
      }
    },
    skipDevice() {
      this.trigger('devicePairingRequestRejected', this.pubKey);
      this.nextPubKey();
      this.showView();
    },
    nextPubKey() {
      // FIFO: pop at the back of the array using pop()
      this.pubKey = this.pubKeyRequests.pop();
    },
    async showView() {
      const defaultView = this.$('.defaultView');
      const waitingForRequestView = this.$('.waitingForRequestView');
      const requestReceivedView = this.$('.requestReceivedView');
      const requestAcceptedView = this.$('.requestAcceptedView');
      if (!this.isListening) {
        const ourPubKey = textsecure.storage.user.getNumber();
        defaultView.show();
        requestReceivedView.hide();
        waitingForRequestView.hide();
        requestAcceptedView.hide();
        const pubKeys = await libloki.storage.getSecondaryDevicesFor(ourPubKey);
        if (pubKeys && pubKeys.length > 0) {
          this.$('#pairedPubKeys').empty();
          pubKeys.forEach(x => {
            let deviceAlias = 'Paired Device';
            const secretWords = window.mnemonic.pubkey_to_secret_words(x);
            const conv = ConversationController.get(x);
            if (conv) {
              deviceAlias = conv.getNickname();
            }
            this.$('#pairedPubKeys').append(`<li>${deviceAlias} (${secretWords})</li>`);
          });
        }
      } else if (this.accepted) {
        defaultView.hide();
        requestReceivedView.hide();
        waitingForRequestView.hide();
        requestAcceptedView.show();
      } else if (this.pubKey) {
        const secretWords = window.mnemonic.pubkey_to_secret_words(this.pubKey);
        this.$('.secretWords').text(secretWords);
        requestReceivedView.show();
        waitingForRequestView.hide();
        requestAcceptedView.hide();
        defaultView.hide();
      } else {
        waitingForRequestView.show();
        requestReceivedView.hide();
        requestAcceptedView.hide();
        defaultView.hide();
      }
    },
    close() {
      this.remove();
      if (this.pubKey && !this.accepted) {
        this.trigger('devicePairingRequestRejected', this.pubKey);
      }
      this.trigger('close');
    },
  });
})();
