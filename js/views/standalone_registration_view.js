/* global Whisper, $, getAccountManager, textsecure, i18n, passwordUtil, _, setTimeout */

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  const REGISTER_INDEX = 0;
  const PROFILE_INDEX = 1;
  let currentPageIndex = REGISTER_INDEX;

  Whisper.StandaloneRegistrationView = Whisper.View.extend({
    templateName: 'standalone',
    className: 'full-screen-flow standalone-fullscreen',
    initialize() {
      this.accountManager = getAccountManager();

      this.render();

      const number = textsecure.storage.user.getNumber();
      if (number) {
        this.$('input.number').val(number);
      }
      this.phoneView = new Whisper.PhoneInputView({
        el: this.$('#phone-number-input'),
      });
      this.$('#error').hide();

      this.$('.standalone-mnemonic').hide();

      this.onGenerateMnemonic();

      const options = window.mnemonic.get_languages().map(language => {
        const text = language
          // Split by whitespace or underscore
          .split(/[\s_]+/)
          // Capitalise each word
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        return `<option value="${language}">${text}</option>`;
      });
      this.$('#mnemonic-language').append(options);
      this.$('#mnemonic-language').val('english');
      this.$('#mnemonic-display-language').append(options);
      this.$('#mnemonic-display-language').val('english');

      this.$passwordInput = this.$('#password');
      this.$passwordConfirmationInput = this.$('#password-confirmation');
      this.$passwordInputError = this.$('.password-inputs .error');

      this.registrationParams = {};
      this.$pages = this.$('.page');
      this.showRegisterPage();

      this.onValidatePassword();

      const sanitiseNameInput = () => {
        const oldVal = this.$('#display-name').val();
        this.$('#display-name').val(oldVal.replace(/[^a-zA-Z0-9 ]/g, ''));
      };

      this.$('#display-name').get(0).oninput = () => {
        sanitiseNameInput();
      };

      this.$('#display-name').get(0).onpaste = () => {
        // Sanitise data immediately after paste because it's easier
        setTimeout(() => {
          sanitiseNameInput();
        });
      };
    },
    events: {
      keyup: 'onKeyup',
      'validation input.number': 'onValidation',
      'click #request-voice': 'requestVoice',
      'click #request-sms': 'requestSMSVerification',
      'change #code': 'onChangeCode',
      'click #register': 'registerWithoutMnemonic',
      'click #register-mnemonic': 'registerWithMnemonic',
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
    async showPage(pageIndex) {
      // eslint-disable-next-line func-names
      this.$pages.each(function(index) {
        if (index !== pageIndex) {
          $(this).hide();
        } else {
          $(this).show();
          currentPageIndex = pageIndex;
        }
      });
    },
    async showRegisterPage() {
      this.registrationParams = {};
      this.showPage(REGISTER_INDEX);
    },
    async showProfilePage(mnemonic, language) {
      this.registrationParams = {
        mnemonic,
        language,
      };
      this.$passwordInput.val('');
      this.$passwordConfirmationInput.val('');
      this.onValidatePassword();
      this.showPage(PROFILE_INDEX);
      this.$('#display-name').focus();
    },
    onKeyup(event) {
      if (currentPageIndex !== PROFILE_INDEX) {
        // Only want enter/escape keys to work on profile page
        return;
      }

      switch (event.key) {
        case 'Enter':
          this.onSaveProfile();
          break;
        case 'Escape':
        case 'Esc':
          this.onBack();
          break;
        default:
      }
    },
    async register(mnemonic, language) {
      // Make sure the password is valid
      if (this.validatePassword()) {
        this.showToast(i18n('invalidPassword'));
        return;
      }

      const input = this.trim(this.$passwordInput.val());

      try {
        await window.setPassword(input);
        await this.accountManager.registerSingleDevice(
          mnemonic,
          language,
          this.$('#display-name').val()
        );
        this.$el.trigger('openInbox');
      } catch (e) {
        if (typeof e === 'string') {
          this.showToast(e);
        }
        this.log(e);
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
    onBack() {
      this.showRegisterPage();
    },
    onChangeMnemonic() {
      this.$('#status').html('');
    },
    async onGenerateMnemonic() {
      const language = this.$('#mnemonic-display-language').val();
      const mnemonic = await this.accountManager.generateMnemonic(language);
      this.$('#mnemonic-display').text(mnemonic);
    },
    onCopyMnemonic() {
      window.clipboard.writeText(this.$('#mnemonic-display').text());

      this.showToast(i18n('copiedMnemonic'));
    },
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
    onValidation() {
      if (this.$('#number-container').hasClass('valid')) {
        this.$('#request-sms, #request-voice').removeAttr('disabled');
      } else {
        this.$('#request-sms, #request-voice').prop('disabled', 'disabled');
      }
    },
    onChangeCode() {
      if (!this.validateCode()) {
        this.$('#code').addClass('invalid');
      } else {
        this.$('#code').removeClass('invalid');
      }
    },
    requestVoice() {
      window.removeSetupMenuItems();
      this.$('#error').hide();
      const number = this.phoneView.validateNumber();
      if (number) {
        this.accountManager
          .requestVoiceVerification(number)
          .catch(this.displayError.bind(this));
        this.$('#step2')
          .addClass('in')
          .fadeIn();
      } else {
        this.$('#number-container').addClass('invalid');
      }
    },
    requestSMSVerification() {
      window.removeSetupMenuItems();
      $('#error').hide();
      const number = this.phoneView.validateNumber();
      if (number) {
        this.accountManager
          .requestSMSVerification(number)
          .catch(this.displayError.bind(this));
        this.$('#step2')
          .addClass('in')
          .fadeIn();
      } else {
        this.$('#number-container').addClass('invalid');
      }
    },
    toggleSection(e) {
      // Expand or collapse this panel
      const $target = this.$(e.currentTarget);
      const $next = $target.next();

      // Toggle section visibility
      $next.slideToggle('fast');
      $target.toggleClass('section-toggle-visible');

      // Hide the other sections
      this.$('.section-toggle')
        .not($target)
        .removeClass('section-toggle-visible');
      this.$('.section-content')
        .not($next)
        .slideUp('fast');
    },
    validatePassword() {
      const input = this.trim(this.$passwordInput.val());
      const confirmationInput = this.trim(
        this.$passwordConfirmationInput.val()
      );

      // If user hasn't set a value then skip
      if (!input && !confirmationInput) {
        return null;
      }

      const error = passwordUtil.validatePassword(input, i18n);
      if (error) {
        return error;
      }

      if (input !== confirmationInput) {
        return "Password don't match";
      }

      return null;
    },
    onValidatePassword() {
      const passwordValidation = this.validatePassword();
      if (passwordValidation) {
        this.$passwordInput.addClass('error-input');
        this.$passwordConfirmationInput.addClass('error-input');

        this.$passwordInput.removeClass('match-input');
        this.$passwordConfirmationInput.removeClass('match-input');

        this.$passwordInputError.text(passwordValidation);
        this.$passwordInputError.show();
      } else {
        this.$passwordInput.removeClass('error-input');
        this.$passwordConfirmationInput.removeClass('error-input');

        this.$passwordInputError.text('');
        this.$passwordInputError.hide();

        // Show green box around inputs that match
        const input = this.trim(this.$passwordInput.val());
        const confirmationInput = this.trim(
          this.$passwordConfirmationInput.val()
        );
        if (input && input === confirmationInput) {
          this.$passwordInput.addClass('match-input');
          this.$passwordConfirmationInput.addClass('match-input');
        } else {
          this.$passwordInput.removeClass('match-input');
          this.$passwordConfirmationInput.removeClass('match-input');
        }
      }
    },
    trim(value) {
      return value ? value.trim() : value;
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
