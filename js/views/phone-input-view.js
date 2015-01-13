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
				if (regionCode != "US" && regionCode != "CA") {
						var imageName = "images/flags/" + regionCode.toLowerCase() + ".svg";
						$('#regionCodeTest').append(
						$('<option>', { value: regionCode, text: countryName, 'data-imagesrc': imageName })
				);
				}
			});
			$('#regionCodeTest').ddslick();
            return this;
		}
	});
})();