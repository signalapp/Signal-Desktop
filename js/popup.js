/* vim: ts=4:sw=4
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

$('#inbox_link').click(function() {
	$('#inbox').show();
	$('#send').hide();
});
$('#send_link').click(function() {
	$('#inbox').hide();
	$('#send').show();
});

textsecure.registerOnLoadFunction(function() {
	if (storage.getUnencrypted("number_id") === undefined) {
		chrome.tabs.create({url: "options.html"});
	} else {
		function fillMessages() {
			var MAX_MESSAGES_PER_CONVERSATION = 4;
			var MAX_CONVERSATIONS = 5;

			var conversations = [];

			var messageMap = getMessageMap();
			for (conversation in messageMap) {
				var messages = messageMap[conversation];
				messages.sort(function(a, b) { return b.timestamp - a.timestamp; });
				conversations[conversations.length] = messages;
			}

			conversations.sort(function(a, b) { return b[0].timestamp - a[0].timestamp });

			var ul = $('#conversations');
			ul.html('');
			for (var i = 0; i < MAX_CONVERSATIONS && i < conversations.length; i++) {
				var conversation = conversations[i];
				var messages = $('<ul class="conversation">');
				for (var j = 0; j < MAX_MESSAGES_PER_CONVERSATION && j < conversation.length; j++) {
					var message = conversation[j];
					$('<li class="message incoming container">').
						append($('<div class="avatar">')).
						append($('<div class="bubble">').
							append($('<span class="message-text">').text(message.message)).
							append($('<span class="metadata">').text("From: " + message.sender + ", at: " + timestampToHumanReadable(message.timestamp)))
						).appendTo(messages);
				}
				var button = $('<button id="button' + i + '">').text('Send');
				var input = $('<input id="text' + i + '">');
				$('<li>').
					append(messages).
					append($("<form class='container'>").append(input).append(button)).
					appendTo(ul);
				button.click(function() {
					button.attr("disabled", "disabled");
					button.text("Sending");

					var sendDestinations = [conversation[0].sender];
					if (conversation[0].group)
						sendDestinations = conversation[0].group.members;

					var messageProto = new PushMessageContentProtobuf();
					messageProto.body = input.val();

					textsecure.sendMessage(sendDestinations, messageProto, function(result) {
						console.log(result);
						button.removeAttr("disabled");
						button.text("Send");
						input.val("");
					});
				});
			}
		}

		$(window).bind('storage', function(e) {
			console.log("Got localStorage update for key " + e.key);
			if (event.key == "emessageMap")//TODO: Fix when we get actual encryption
				fillMessages();
		});
		fillMessages();
		$('.my-number').text(storage.getUnencrypted("number_id").split(".")[0]);
		storage.putUnencrypted("unreadCount", 0);
		chrome.browserAction.setBadgeText({text: ""});
		$("#me").click(function() {
			$('#popup_send_numbers').val($('.my-number').text());
		});

		$("#popup_send_button").click(function() {
			var numbers = [];
			var splitString = $("#popup_send_numbers").val().split(",");
			for (var i = 0; i < splitString.length; i++) {
				try {
					numbers.push(verifyNumber(splitString[i]));
				} catch (numberError) {
					//TODO
					alert(numberError);
				}
			}
			var messageProto = new PushMessageContentProtobuf();
			messageProto.body = $("#popup_send_text").val();
			textsecure.sendMessage(numbers, messageProto,
				//TODO: Handle result
				function(thing) {console.log(thing);});
		});
	}
});
