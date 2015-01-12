var Whisper = Whisper || {};

(function () {
	'use strict';
	Whisper.PhoneInputView = Backbone.View.extend({
		className: "phone-input",
		initialize: function() {
			this.template = $('#phone-number').html();
			Mustache.parse(this.template);
			this.render;
		},

		render: function() {
			this.$el.html(Mustache.render(this.template));
			return this;
		}
	});
})();