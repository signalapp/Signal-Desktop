(function () {
	'use strict';
	window.Whisper = window.Whisper || {};

	Whisper.PhoneInputView = Backbone.View.extend({
		className: 'phone-input',
		initialize: function() {
			this.template = $('#phone-input').html();
			Mustache.parse(this.template);
		},

		events: {
			'change': 'validateNumber'
		},


	});
})();