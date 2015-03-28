/* vim: ts=4:sw=4:expandtab
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
(function () {
    'use strict';
    window.Whisper = window.Whisper || {};

    Whisper.PhoneInputView = Whisper.View.extend({
        tagName: 'div',
        className: 'phone-input',
        template: $('#phone-number').html(),
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
            try {
                var regionCode = this.$('li.active').attr('data-country-code').toUpperCase();
                var number = input.val();

                var parsedNumber = libphonenumber.util.verifyNumber(number, regionCode);

                this.$('.number-container').removeClass('invalid');
                this.$('.number-container').addClass('valid');
                return parsedNumber;
            } catch(e) {
                this.$('.number-container').removeClass('valid');
            } finally {
                input.trigger('validation');
            }
        }
    });
})();
