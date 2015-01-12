var Whisper = Whisper || {};

(function () {
	'use strict';
	Whisper.PhoneInputView = Backbone.View.extend({
		className: 'phone-input',
		initialize: function() {
			this.template = $('#phone').html();
			Mustache.parse(this.template);
		},

		render: function() {
			this.$el.html(
				Mustache.render(this.template));
			return this;
		},
	});
})();