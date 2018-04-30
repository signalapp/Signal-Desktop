(function() {
  'use strict';
  window.Whisper = window.Whisper || {};

  Whisper.KeyVerificationPanelView = Whisper.View.extend({
    className: 'key-verification panel',
    templateName: 'key-verification',
    events: {
      'click button.verify': 'toggleVerified',
    },
    initialize: function(options) {
      this.ourNumber = textsecure.storage.user.getNumber();
      if (options.newKey) {
        this.theirKey = options.newKey;
      }

      this.loadKeys().then(
        function() {
          this.listenTo(this.model, 'change', this.render);
        }.bind(this)
      );
    },
    loadKeys: function() {
      return Promise.all([this.loadTheirKey(), this.loadOurKey()])
        .then(this.generateSecurityNumber.bind(this))
        .then(this.render.bind(this));
      //.then(this.makeQRCode.bind(this));
    },
    makeQRCode: function() {
      // Per Lilia: We can't turn this on until it generates a Latin1 string, as is
      //   required by the mobile clients.
      new QRCode(this.$('.qr')[0]).makeCode(
        dcodeIO.ByteBuffer.wrap(this.ourKey).toString('base64')
      );
    },
    loadTheirKey: function() {
      return textsecure.storage.protocol.loadIdentityKey(this.model.id).then(
        function(theirKey) {
          this.theirKey = theirKey;
        }.bind(this)
      );
    },
    loadOurKey: function() {
      return textsecure.storage.protocol.loadIdentityKey(this.ourNumber).then(
        function(ourKey) {
          this.ourKey = ourKey;
        }.bind(this)
      );
    },
    generateSecurityNumber: function() {
      return new libsignal.FingerprintGenerator(5200)
        .createFor(this.ourNumber, this.ourKey, this.model.id, this.theirKey)
        .then(
          function(securityNumber) {
            this.securityNumber = securityNumber;
          }.bind(this)
        );
    },
    onSafetyNumberChanged: function() {
      this.model.getProfiles().then(this.loadKeys.bind(this));

      var dialog = new Whisper.ConfirmationDialogView({
        message: i18n('changedRightAfterVerify', [
          this.model.getTitle(),
          this.model.getTitle(),
        ]),
        hideCancel: true,
      });

      dialog.$el.insertBefore(this.el);
      dialog.focusCancel();
    },
    toggleVerified: function() {
      this.$('button.verify').attr('disabled', true);
      this.model
        .toggleVerified()
        .catch(
          function(result) {
            if (result instanceof Error) {
              if (result.name === 'OutgoingIdentityKeyError') {
                this.onSafetyNumberChanged();
              } else {
                console.log('failed to toggle verified:', result.stack);
              }
            } else {
              var keyError = _.some(result.errors, function(error) {
                return error.name === 'OutgoingIdentityKeyError';
              });
              if (keyError) {
                this.onSafetyNumberChanged();
              } else {
                _.forEach(result.errors, function(error) {
                  console.log('failed to toggle verified:', error.stack);
                });
              }
            }
          }.bind(this)
        )
        .then(
          function() {
            this.$('button.verify').removeAttr('disabled');
          }.bind(this)
        );
    },
    render_attributes: function() {
      var s = this.securityNumber;
      var chunks = [];
      for (var i = 0; i < s.length; i += 5) {
        chunks.push(s.substring(i, i + 5));
      }
      var name = this.model.getTitle();
      var yourSafetyNumberWith = i18n('yourSafetyNumberWith', name);
      var isVerified = this.model.isVerified();
      var verifyButton = isVerified ? i18n('unverify') : i18n('verify');
      var verifiedStatus = isVerified
        ? i18n('isVerified', name)
        : i18n('isNotVerified', name);

      return {
        learnMore: i18n('learnMore'),
        theirKeyUnknown: i18n('theirIdentityUnknown'),
        yourSafetyNumberWith: i18n(
          'yourSafetyNumberWith',
          this.model.getTitle()
        ),
        verifyHelp: i18n('verifyHelp', this.model.getTitle()),
        verifyButton: verifyButton,
        hasTheirKey: this.theirKey !== undefined,
        chunks: chunks,
        isVerified: isVerified,
        verifiedStatus: verifiedStatus,
      };
    },
  });
})();
