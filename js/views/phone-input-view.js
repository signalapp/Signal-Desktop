var Whisper = Whisper || {};

(function () {
	'use strict';
	Whisper.PhoneInputView = Backbone.View.extend({
		tagName: 'div',
		className: 'phone-input',
		initialize: function() {
			this.template = $('#phone-number').html();
			Mustache.parse(this.template);
			this.render();
		},

		render: function() {
			this.$el.html($(Mustache.render(this.template)));
			this.$el.find('input.number').intlTelInput();
            return this;
		},

		events: {
			'change': 'validateNumber',
			'keyup': 'validateNumber'
		},

		validateNumber: function() {
			try {
				var regionCode = this.$el.find('li.active').attr('data-country-code').toUpperCase();
				var number = this.$el.find('input.number').val();

				var parsedNumber = libphonenumber.util.verifyNumber(number, regionCode);

				this.$el.find('#number-container').removeClass('invalid');
				this.$el.find('#number-container').addClass('valid');
				return parsedNumber;
			} catch(e) {
				this.$el.find('#number-container').removeClass('valid');
			}
		}
	});
})();