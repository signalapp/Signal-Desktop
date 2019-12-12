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

  class TextScramble {
    constructor(el) {
      this.el = el;
      this.chars = '0123456789qwertyuiopasdfghjklzxcvbnm';
      this.update = this.update.bind(this);
    }

    setText(newText) {
      const oldText = this.el.innerText;
      const length = Math.max(oldText.length, newText.length);
      // eslint-disable-next-line no-return-assign
      const promise = new Promise(resolve => (this.resolve = resolve));
      this.queue = [];

      for (let i = 0; i < length; i++) {
        const from = oldText[i] || '';
        const to = newText[i] || '';
        const start = Math.floor(Math.random() * 40);
        const end = start + Math.floor(Math.random() * 40);
        this.queue.push({
          from,
          to,
          start,
          end,
        });
      }

      cancelAnimationFrame(this.frameRequest);
      this.frame = 0;
      this.update();
      return promise;
    }

    update() {
      let output = '';
      let complete = 0;

      for (let i = 0, n = this.queue.length; i < n; i++) {
        const { from, to, start, end } = this.queue[i];
        let { char } = this.queue[i];

        if (this.frame >= end) {
          complete++;
          output += to;
        } else if (this.frame >= start) {
          if (!char || Math.random() < 0.28) {
            char = this.randomChar();
            this.queue[i].char = char;
          }

          output += `<span class="dud">${char}</span>`;
        } else {
          output += from;
        }
      }

      this.el.innerHTML = output;

      if (complete === this.queue.length) {
        this.resolve();
      } else {
        this.frameRequest = requestAnimationFrame(this.update);
        this.frame++;
      }
    }

    randomChar() {
      return this.chars[Math.floor(Math.random() * this.chars.length)];
    }

  }
  window.Session = window.Session || {};

  window.Session.setNewSessionID = (sessionID) => {
    const el = document.querySelector('.session-signin-enter-session-id');
    const fx = new TextScramble(el);
    fx.setText(sessionID);
  };
})();
