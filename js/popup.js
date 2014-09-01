/* vim: ts=4:sw=4:noexpandtab:
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

Whisper.Layout = new (Backbone.View.extend({
	initialize: function() {
		this.gutter = $('#gutter');
		this.contacts = $('#contacts');
		this.resize();

		new Whisper.ConversationListView({el: $('#contacts')});
		new Whisper.Header({el: $('#header')});
		Whisper.Threads.fetch({reset: true});
	},
	events: {
		'resize': 'resize'
	},
	resize: function (e) {
		var windowheight = window.innerHeight;
		var form = $('.send-message-area').outerHeight();
		var gutter_offset = this.gutter.offset().top;
		var contacts_offset = this.contacts.offset().top;
		if (window.innerWidth < 480) {
			this.gutter.css('height', windowheight - gutter_offset - form);
			this.contacts.css('height', windowheight - contacts_offset - form);
		} else {
			this.gutter.css('height', windowheight - gutter_offset);
			this.contacts.css('height', windowheight - contacts_offset);
		}
		$('.discussion').css('height', windowheight - gutter_offset - form);
	},
	setContent: function(content) {
		$(content).insertAfter(this.gutter);
		this.resize();
	}
}))({el: window});

textsecure.registerOnLoadFunction(function() {
	if (textsecure.storage.getUnencrypted("number_id") === undefined) {
		extension.navigator.tabs.create("options.html");
	} else {
		textsecure.storage.putUnencrypted("unreadCount", 0);
		extension.navigator.setBadgeText("");
	}
});
