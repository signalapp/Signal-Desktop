// Copyright 2017-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as log from '../logging/log';
import { PhoneInputView } from './phone_input_view';

window.Whisper = window.Whisper || {};

const { Whisper } = window;

export const StandaloneRegistrationView = Whisper.View.extend({
  template: () => $('#standalone').html(),
  className: 'full-screen-flow',
  initialize() {
    window.readyForUpdates();

    this.accountManager = window.getAccountManager();

    this.render();

    const number = window.textsecure.storage.user.getNumber();
    if (number) {
      this.$('input.number').val(number);
    }
    this.phoneView = new PhoneInputView({
      el: this.$('#phone-number-input'),
    });
    this.$('#error').hide();
  },
  events: {
    'validation input.number': 'onValidation',
    'click #request-voice': 'requestVoice',
    'click #request-sms': 'requestSMSVerification',
    'change #code': 'onChangeCode',
    'click #verifyCode': 'verifyCode',
  },
  getVerificationCode() {
    const codeHTML = $('#code').val();
    if (!codeHTML) {
      return;
    }
    return String(codeHTML).replace(/\D+/g, '');
  },
  async verifyCode() {
    const number = this.phoneView.validateNumber();
    const verificationCode = this.getVerificationCode();

    try {
      await this.accountManager.registerSingleDevice(number, verificationCode);
      this.$el.trigger('openInbox');
    } catch (err) {
      this.log(err);
    }
  },
  log(s: Error) {
    log.info(s);
    this.$('#status').text(s);
  },
  validateCode() {
    const verificationCode = this.getVerificationCode();

    if (verificationCode.length === 6) {
      return verificationCode;
    }

    return null;
  },
  displayError(error: Error) {
    this.$('#error').hide().text(error).addClass('in').fadeIn();
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
  async requestVoice() {
    window.removeSetupMenuItems();
    this.$('#error').hide();
    const number = this.phoneView.validateNumber();
    if (number) {
      this.$('#step2').addClass('in').fadeIn();
      try {
        await this.accountManager.requestVoiceVerification(number);
      } catch (err) {
        this.displayError(err);
      }
    } else {
      this.$('#number-container').addClass('invalid');
    }
  },
  async requestSMSVerification() {
    window.removeSetupMenuItems();
    $('#error').hide();
    const number = this.phoneView.validateNumber();
    if (number) {
      this.$('#step2').addClass('in').fadeIn();
      try {
        await this.accountManager.requestSMSVerification(number);
      } catch (err) {
        this.displayError(err);
      }
    } else {
      this.$('#number-container').addClass('invalid');
    }
  },
});

Whisper.StandaloneRegistrationView = StandaloneRegistrationView;
