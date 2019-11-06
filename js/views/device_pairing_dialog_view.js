/* global Whisper, i18n, libloki, textsecure, ConversationController, $, lokiFileServerAPI */

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
      this.pubKeyToUnpair = null;
      this.success = false;
    },
    events: {
      'click #startPairing': 'startReceivingRequests',
      'click #close': 'close',
      'click .waitingForRequestView .cancel': 'stopReceivingRequests',
      'click .requestReceivedView .skip': 'skipDevice',
      'click #allowPairing': 'allowDevice',
      'click .requestAcceptedView .ok': 'stopReceivingRequests',
      'click .confirmUnpairView .cancel': 'stopReceivingRequests',
      'click .confirmUnpairView .unpairDevice': 'confirmUnpairDevice',
    },
    render_attributes() {
      return {
        defaultTitle: i18n('pairedDevices'),
        waitingForRequestTitle: i18n('waitingForDeviceToRegister'),
        requestReceivedTitle: i18n('devicePairingReceived'),
        requestAcceptedTitle: i18n('devicePairingAccepted'),
        startPairingText: i18n('pairNewDevice'),
        cancelText: i18n('cancel'),
        UnpairDevice: i18n('unpairDevice'),
        closeText: i18n('close'),
        skipText: i18n('skip'),
        okText: i18n('ok'),
        allowPairingText: i18n('allowPairing'),
        confirmUnpairViewTitle: i18n('confirmUnpairingTitle'),
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
        this.$('#deviceAlias').on('keydown', e => {
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
    async confirmUnpairDevice() {
      await libloki.storage.removePairingAuthorisationForSecondaryPubKey(
        this.pubKeyToUnpair
      );
      await lokiFileServerAPI.updateOurDeviceMapping();
      this.reset();
      this.showView();
    },
    requestUnpairDevice(pubKey) {
      this.pubKeyToUnpair = pubKey;
      this.showView();
    },
    getPubkeyName(pubKey) {
      const secretWords = window.mnemonic.pubkey_to_secret_words(pubKey);
      const conv = ConversationController.get(pubKey);
      const deviceAlias = conv ? conv.getNickname() : 'Unnamed Device';
      return `${deviceAlias} (pairing secret: <i>${secretWords}</i>)`;
    },
    async showView() {
      const defaultView = this.$('.defaultView');
      const waitingForRequestView = this.$('.waitingForRequestView');
      const requestReceivedView = this.$('.requestReceivedView');
      const requestAcceptedView = this.$('.requestAcceptedView');
      const confirmUnpairView = this.$('.confirmUnpairView');
      if (this.pubKeyToUnpair) {
        defaultView.hide();
        requestReceivedView.hide();
        waitingForRequestView.hide();
        requestAcceptedView.hide();
        confirmUnpairView.show();
        const name = this.getPubkeyName(this.pubKeyToUnpair);
        this.$('.confirmUnpairView #pubkey').html(name);
      } else if (!this.isListening) {
        requestReceivedView.hide();
        waitingForRequestView.hide();
        requestAcceptedView.hide();
        confirmUnpairView.hide();

        const ourPubKey = textsecure.storage.user.getNumber();
        defaultView.show();
        const pubKeys = await libloki.storage.getSecondaryDevicesFor(ourPubKey);
        this.$('#pairedPubKeys').empty();
        if (pubKeys && pubKeys.length > 0) {
          pubKeys.forEach(x => {
            const name = this.getPubkeyName(x);
            const li = $('<li>').html(`${name}  - `);
            const link = $('<a>')
              .text('Unpair')
              .attr('href', '#');
            link.on('click', () => this.requestUnpairDevice(x));
            li.append(link);
            this.$('#pairedPubKeys').append(li);
          });
        } else {
          this.$('#pairedPubKeys').append('<li>No paired devices</li>');
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
