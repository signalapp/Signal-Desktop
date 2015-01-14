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
			$.each(libphonenumber.util.getAllRegionCodes(), function(regionCode, countryName) {
					$('select.regionCode').append(
					$('<option>', { value: regionCode, text: countryName}));
					console.log(countryName);

			});
			console.log(this.$el);
            return this;
		},

		events: {
			'change': 'validateNumber',
			'keyup': 'validateNumber'
		},

		validateNumber: function() {
			try {
				var regionCode = $('select.regionCode').val();
				var number = $('input.number').val();

				var parsedNumber = libphonenumber.util.verifyNumber(number, regionCode);

				$('select.regionCode').val(libphonenumber.util.getRegionCodeForNumber(parsedNumber));
				$('#number-container').removeClass('invalid');
				$('#number-container').addClass('valid');
				return parsedNumber;
			} catch(e) {
				$('#number-container').removeClass('valid');
			}
		}
	});
})();