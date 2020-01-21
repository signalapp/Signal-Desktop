/* global Whisper, textsecure, QRCode, dcodeIO, libsignal, i18n, _ */

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.KeyVerificationPanelView = Whisper.View.extend({
    className: 'key-verification panel',
    templateName: 'key-verification',
    events: {
      'click button.verify': 'toggleVerified',
    },
    initialize(options) {
      this.ourNumber = textsecure.storage.user.getNumber();
      if (options.newKey) {
        this.theirKey = options.newKey;
      }

      this.loadKeys().then(() => {
        this.listenTo(this.model, 'change', this.render);
      });
    },
    loadKeys() {
      return Promise.all([this.loadTheirKey(), this.loadOurKey()])
        .then(this.generateSecurityNumber.bind(this))
        .then(this.render.bind(this));
      // .then(this.makeQRCode.bind(this));
    },
    makeQRCode() {
      // Per Lilia: We can't turn this on until it generates a Latin1 string, as is
      //   required by the mobile clients.
      new QRCode(this.$('.qr')[0]).makeCode(
        dcodeIO.ByteBuffer.wrap(this.ourKey).toString('base64')
      );
    },
    loadTheirKey() {
      return textsecure.storage.protocol
        .loadIdentityKey(this.model.id)
        .then(theirKey => {
          this.theirKey = theirKey;
        });
    },
    loadOurKey() {
      return textsecure.storage.protocol
        .loadIdentityKey(this.ourNumber)
        .then(ourKey => {
          this.ourKey = ourKey;
        });
    },
    generateSecurityNumber() {
      return new libsignal.FingerprintGenerator(5200)
        .createFor(this.ourNumber, this.ourKey, this.model.id, this.theirKey)
        .then(securityNumber => {
          this.securityNumber = securityNumber;
        });
    },
    onSafetyNumberChanged() {
      this.model.getProfiles().then(this.loadKeys.bind(this));

      window.confirmationDialog({
        title: i18n('changedSinceVerifiedTitle'),
        message: i18n('changedRightAfterVerify', [
          this.model.getTitle(),
          this.model.getTitle(),
        ]),
        hideCancel: true,
      });
    },
    toggleVerified() {
      this.$('button.verify').attr('disabled', true);
      this.model
        .toggleVerified()
        .catch(result => {
          if (result instanceof Error) {
            if (result.name === 'OutgoingIdentityKeyError') {
              this.onSafetyNumberChanged();
            } else {
              window.log.error(
                'failed to toggle verified:',
                result && result.stack ? result.stack : result
              );
            }
          } else {
            const keyError = _.some(
              result.errors,
              error => error.name === 'OutgoingIdentityKeyError'
            );
            if (keyError) {
              this.onSafetyNumberChanged();
            } else {
              _.forEach(result.errors, error => {
                window.log.error(
                  'failed to toggle verified:',
                  error && error.stack ? error.stack : error
                );
              });
            }
          }
        })
        .then(() => {
          this.$('button.verify').removeAttr('disabled');
        });
    },
    render_attributes() {
      const s = this.securityNumber;
      const chunks = [];
      for (let i = 0; i < s.length; i += 5) {
        chunks.push(s.substring(i, i + 5));
      }
      const name = this.model.getTitle();
      const yourSafetyNumberWith = i18n(
        'yourSafetyNumberWith',
        this.model.getTitle()
      );
      const isVerified = this.model.isVerified();
      const verifyButton = isVerified ? i18n('unverify') : i18n('verify');
      const verifiedStatus = isVerified
        ? i18n('isVerified', name)
        : i18n('isNotVerified', name);

      return {
        learnMore: i18n('learnMore'),
        theirKeyUnknown: i18n('theirIdentityUnknown'),
        yourSafetyNumberWith,
        verifyHelp: i18n('verifyHelp', this.model.getTitle()),
        verifyButton,
        hasTheirKey: this.theirKey !== undefined,
        chunks,
        isVerified,
        verifiedStatus,
      };
    },
  });
})();
