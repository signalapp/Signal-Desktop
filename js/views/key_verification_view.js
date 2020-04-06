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
      this.ourUuid = textsecure.storage.user.getUuid();
      if (options.newKey) {
        this.theirKey = options.newKey;
      }

      this.loadTheirKey();
      this.loadOurKey();

      this.render();
      if (options.onLoad) {
        options.onLoad(this);
      }

      this.loadKeys().then(() => {
        this.listenTo(this.model, 'change', this.render);
      });
    },
    async loadKeys() {
      await this.generateSecurityNumber();
      this.render();
    },
    makeQRCode() {
      // Per Lilia: We can't turn this on until it generates a Latin1 string, as is
      //   required by the mobile clients.
      new QRCode(this.$('.qr')[0]).makeCode(
        dcodeIO.ByteBuffer.wrap(this.ourKey).toString('base64')
      );
    },
    loadTheirKey() {
      const item = textsecure.storage.protocol.getIdentityRecord(
        this.model.get('id')
      );
      this.theirKey = item ? item.publicKey : null;
    },
    loadOurKey() {
      const item = textsecure.storage.protocol.getIdentityRecord(
        this.ourUuid || this.ourNumber
      );
      this.ourKey = item ? item.publicKey : null;
    },
    generateSecurityNumber() {
      return new libsignal.FingerprintGenerator(5200)
        .createFor(
          // TODO: we cannot use UUIDs for safety numbers yet
          // this.ourUuid || this.ourNumber,
          this.ourNumber,
          this.ourKey,
          // TODO: we cannot use UUIDs for safety numbers yet
          // this.model.get('uuid') || this.model.get('e164'),
          this.model.get('e164'),
          this.theirKey
        )
        .then(securityNumber => {
          this.securityNumber = securityNumber;
        });
    },
    onSafetyNumberChanged() {
      this.model.getProfiles().then(this.loadKeys.bind(this));

      const dialog = new Whisper.ConfirmationDialogView({
        message: i18n('changedRightAfterVerify', [
          this.model.getTitle(),
          this.model.getTitle(),
        ]),
        hideCancel: true,
      });

      dialog.$el.insertBefore(this.el);
      dialog.focusCancel();
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
      if (s) {
        for (let i = 0; i < s.length; i += 5) {
          chunks.push(s.substring(i, i + 5));
        }
      } else {
        for (let i = 0; i < 12; i += 1) {
          chunks.push('XXXXX');
        }
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
