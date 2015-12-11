/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';
    window.Whisper = window.Whisper || {};

    Whisper.PhoneInputView = Whisper.View.extend({
        tagName: 'div',
        className: 'phone-input',
        templateName: 'phone-number',
        render: function() {
            this.$el.html($(Mustache.render(this.template)));
            this.$('input.number').intlTelInput();
            return this;
        },

        events: {
            'change': 'validateNumber',
            'keyup': 'validateNumber'
        },

        validateNumber: function() {
            var input = this.$('input.number');
            var regionCode = this.$('li.active').attr('data-country-code').toUpperCase();
            var number = input.val();

            var parsedNumber = libphonenumber.util.parseNumber(number, regionCode);
            if (parsedNumber.isValidNumber) {
                this.$('.number-container').removeClass('invalid');
                this.$('.number-container').addClass('valid');
            } else {
                this.$('.number-container').removeClass('valid');
            }
            input.trigger('validation');

            return parsedNumber.e164;
        }
    });
})();
