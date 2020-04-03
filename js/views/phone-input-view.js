/* global libphonenumber, Whisper */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.PhoneInputView = Whisper.View.extend({
    tagName: 'div',
    className: 'phone-input',
    templateName: 'phone-number',
    initialize() {
      this.$('input.number').intlTelInput();
    },
    events: {
      change: 'validateNumber',
      keyup: 'validateNumber',
    },
    validateNumber() {
      const input = this.$('input.number');
      const regionCode = this.$('li.active')
        .attr('data-country-code')
        .toUpperCase();
      const number = input.val();

      const parsedNumber = libphonenumber.util.parseNumber(number, regionCode);
      if (parsedNumber.isValidNumber) {
        this.$('.number-container').removeClass('invalid');
        this.$('.number-container').addClass('valid');
      } else {
        this.$('.number-container').removeClass('valid');
      }
      input.trigger('validation');

      return parsedNumber.e164;
    },
  });
})();
