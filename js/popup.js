$('#inbox_link').onclick = function() {
	$('#inbox').show();
	$('#send').hide();
}
$('#send_link').onclick = function() {
	$('#inbox').hide();
	$('#send').show();
}

registerOnLoadFunction(function() {
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

			var ul = $('#messages');
			ul.html('');
			for (var i = 0; i < MAX_CONVERSATIONS && i < conversations.length; i++) {
				var conversation = conversations[i];
				ul.append('<li>');
				for (var j = 0; j < MAX_MESSAGES_PER_CONVERSATION && j < conversation.length; j++) {
					var message = conversation[j];
					ul.append("From: " + message.sender + ", at: " + timestampToHumanReadable(message.timestamp) + "<br>");
					ul.append("Message: " + message.message + "<br><br>");
				}
				ul.append("<input type='text' id=text" + i + " /><button id=button" + i + ">Send</button><br>");
				$('#button' + i).click(function() {
					var sendDestinations = [conversation[0].sender];
					for (var j = 0; j < conversation[0].destinations.length; j++)
						sendDestinations[sendDestinations.length] = conversation[0].destinations[j];
					sendMessageToNumbers(sendDestinations, { message: $('#text' + i).val() }, function(result) {
						console.log("Sent message: " + JSON.stringify(result));
					}, function(error_msg) {
						alert(error_msg); //TODO
					});
				});
				ul.append('</li>');
			}
		}

		$(window).bind('storage', function(e) {
			console.log("Got localStorage update for key " + e.key);
			if (event.key == "emessageMap")//TODO: Fix when we get actual encryption
				fillMessages();
		});
		fillMessages();
		storage.putUnencrypted("unreadCount", 0);
		chrome.browserAction.setBadgeText({text: ""});
	}
});
