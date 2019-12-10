/* global
 Whisper,
*/

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.SessionRegistrationView = Whisper.View.extend({
    className: 'session-fullscreen',
    initialize() {
      this.render();

      /* 

      this.$passwordInput = this.$('#password');
      this.$passwordConfirmationInput = this.$('#password-confirmation');
      this.$passwordInputError = this.$('.password-inputs .error');

      this.pairingInterval = null;

      this.onSecondaryDeviceRegistered = this.onSecondaryDeviceRegistered.bind(
        this
      ); */
    },
    render() {
      this.session_registration_view = new Whisper.ReactWrapperView({
        className: 'session-full-screen-flow session-fullscreen',
        Component: window.Signal.Components.SessionRegistrationView,
        props: {},
      });

      this.$el.append(this.session_registration_view.el);
      return this;
    },
    /* events: {
      keyup: 'onKeyup',
      'validation input.number': 'onValidation',
      'click #request-voice': 'requestVoice',
      'click #request-sms': 'requestSMSVerification',
      'change #code': 'onChangeCode',
      'click #register': 'registerWithoutMnemonic',
      'click #register-mnemonic': 'registerWithMnemonic',
      'click #register-secondary-device': 'registerSecondaryDevice',
      'click #cancel-secondary-device': 'cancelSecondaryDevice',
      'click #back-button': 'onBack',
      'click #save-button': 'onSaveProfile',
      'change #mnemonic': 'onChangeMnemonic',
      'click #generate-mnemonic': 'onGenerateMnemonic',
      'change #mnemonic-display-language': 'onGenerateMnemonic',
      'click #copy-mnemonic': 'onCopyMnemonic',
      'click .section-toggle': 'toggleSection',
      'keyup #password': 'onValidatePassword',
      'keyup #password-confirmation': 'onValidatePassword',
    }, 

   
    onKeyup(event) {

      const validName = this.sanitiseNameInput();
      switch (event.key) {
        case 'Enter':
          if (event.target.id === 'mnemonic') {
            this.registerWithMnemonic();
          } else if (event.target.id === 'primary-pubkey') {
            this.registerSecondaryDevice();
          } else if (validName) {
            this.onSaveProfile();
          }
          break;
        case 'Escape':
        case 'Esc':
          this.onBack();
          break;
        default:
      }
    },
    
    registerWithoutMnemonic() {
      const mnemonic = this.$('#mnemonic-display').text();
      const language = this.$('#mnemonic-display-language').val();
      this.showProfilePage(mnemonic, language);
    },



    registerWithMnemonic() {
      const mnemonic = this.$('#mnemonic').val();
      const language = this.$('#mnemonic-language').val();
      try {
        window.mnemonic.mn_decode(mnemonic, language);
      } catch (error) {
        this.$('#mnemonic').addClass('error-input');
        this.$('#error').text(error);
        this.$('#error').show();
        return;
      }
      this.$('#error').hide();
      this.$('#mnemonic').removeClass('error-input');
      if (!mnemonic) {
        this.log('Please provide a mnemonic word list');
      } else {
        this.showProfilePage(mnemonic, language);
      }
    },
    onSaveProfile() {
      if (_.isEmpty(this.registrationParams)) {
        this.onBack();
        return;
      }

      const { mnemonic, language } = this.registrationParams;
      this.register(mnemonic, language);
    },
 */
    log(s) {
      window.log.info(s);
      this.$('#status').text(s);
    },
    displayError(error) {
      this.$('#error')
        .hide()
        .text(error)
        .addClass('in')
        .fadeIn();
    },

    showToast(message) {
      const toast = new Whisper.MessageToastView({
        message,
      });
      toast.$el.appendTo(this.$el);
      toast.render();
    },
  });
})();

/*

 async cancelSecondaryDevice() {
      Whisper.events.off(
        'secondaryDeviceRegistration',
        this.onSecondaryDeviceRegistered
      );
      this.$('#register-secondary-device')
        .removeAttr('disabled')
        .text('Link');
      this.$('#cancel-secondary-device').hide();
      this.$('.standalone-secondary-device #pubkey').text('');
      await this.resetRegistration();
    },
    async registerSecondaryDevice() {
      if (textsecure.storage.get('secondaryDeviceStatus') === 'ongoing') {
        return;
      }
      await this.resetRegistration();
      textsecure.storage.put('secondaryDeviceStatus', 'ongoing');
      this.$('#register-secondary-device')
        .attr('disabled', 'disabled')
        .text('Sending...');
      this.$('#cancel-secondary-device').show();
      const mnemonic = this.$('#mnemonic-display').text();
      const language = this.$('#mnemonic-display-language').val();
      const primaryPubKey = this.$('#primary-pubkey').val();
      this.$('.standalone-secondary-device #error').hide();
      // Ensure only one listener
      Whisper.events.off(
        'secondaryDeviceRegistration',
        this.onSecondaryDeviceRegistered
      );
      Whisper.events.once(
        'secondaryDeviceRegistration',
        this.onSecondaryDeviceRegistered
      );
      const onError = async error => {
        this.$('.standalone-secondary-device #error')
          .text(error)
          .show();
        await this.resetRegistration();
        this.$('#register-secondary-device')
          .removeAttr('disabled')
          .text('Link');
        this.$('#cancel-secondary-device').hide();
      };
      const c = new Whisper.Conversation({
        id: primaryPubKey,
        type: 'private',
      });
      const validationError = c.validateNumber();
      if (validationError) {
        onError('Invalid public key');
        return;
      }
      try {
        await this.accountManager.registerSingleDevice(
          mnemonic,
          language,
          null
        );
        await this.accountManager.requestPairing(primaryPubKey);
        const pubkey = textsecure.storage.user.getNumber();
        const words = window.mnemonic.pubkey_to_secret_words(pubkey);

        this.$('.standalone-secondary-device #pubkey').text(
          `Here is your secret:\n${words}`
        );
      } catch (e) {
        onError(e);
      }
    },


        async onSecondaryDeviceRegistered() {
      clearInterval(this.pairingInterval);
      // Ensure the left menu is updated
      Whisper.events.trigger('userChanged', { isSecondaryDevice: true });
      // will re-run the background initialisation
      Whisper.events.trigger('registration_done');
      this.$el.trigger('openInbox');
    },

*/
