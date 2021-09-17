// Copyright 2015-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

window.Whisper = window.Whisper || {};

export const PhoneInputView = window.Whisper.View.extend({
  tagName: 'div',
  className: 'phone-input',
  template: () => $('#phone-number').html(),
  initialize() {
    this.$('input.number').intlTelInput();
  },
  events: {
    change: 'validateNumber',
    keydown: 'validateNumber',
  },
  validateNumber() {
    const input = this.$('input.number');
    const regionCode = this.$('li.active')
      .attr('data-country-code')
      .toUpperCase();
    const number = input.val();

    const parsedNumber = window.libphonenumber.util.parseNumber(
      number,
      regionCode
    );
    if (parsedNumber.isValidNumber) {
      this.$('.number-container').removeClass('invalid');
      this.$('.number-container').addClass('valid');
    } else {
      this.$('.number-container').removeClass('valid');
    }
    input.trigger('validation');

    return parsedNumber.isValidNumber ? parsedNumber.e164 : undefined;
  },
});
