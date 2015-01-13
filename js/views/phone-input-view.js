var Whisper = Whisper || {};

(function () {
	'use strict';
	Whisper.PhoneInputView = Backbone.View.extend({
		tagName: 'div',
		className: 'phone-input',
		initialize: function() {
			this.template = '<div id="phone-input-form"><select id="regionCodeTest"><option value="US" data-imagesrc="images/flags/us.svg" selected>United States</option><option value="CA" data-imagesrc="images/flags/ca.svg">Canada</option></select><input type="text" id="phoneNumberTest" placeholder="Phone Number" /></div>';
			//this.template = $('#phone-number').html();
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