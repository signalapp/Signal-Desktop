var Whisper = Whisper || {};

(function () {
	'use strict';
	Whisper.PhoneInputView = Backbone.View.extend({
		tagName: 'div',
		className: 'phone-input',
		initialize: function() {
			this.template = $('#phone-number').html();
			Mustache.parse(this.template);
			//this.template = _.template($('#phone-number').html());
			this.render();
		},

		render: function() {
			this.$el.html(Mustache.render(this.template, {}));
            return this;
		}
	});
})();