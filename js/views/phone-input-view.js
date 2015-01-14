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
			this.$el.html(Mustache.render(this.template, {}));
			$.each(libphonenumber.util.getAllRegionCodes(), function(regionCode, countryName) {
					$('#regionCode').append(
					$('<option>', { value: regionCode, text: countryName}));
			});
            return this;
		},

		events: {
			'change': 'validateNumber',
			'keyup': 'validateNumber'
		},

		validateNumber: function() {
			try {
				var regionCode = $('#regionCode').val();
				var number = $('#number').val();

				var parsedNumber = libphonenumber.util.verifyNumber(number, regionCode);

				$('#regionCode').val(libphonenumber.util.getRegionCodeForNumber(parsedNumber));
				$('#number-container').removeClass('invalid');
				$('#number-container').addClass('valid');
				return parsedNumber;
			} catch(e) {
				$('#number-container').removeClass('valid');
			}
		}
	});
})();