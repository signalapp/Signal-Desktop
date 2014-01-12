$('#inbox_link').onclick = function() {
	$('#inbox').show();
	$('#send').hide();
}
$('#send_link').onclick = function() {
	$('#inbox').hide();
	$('#send').show();
}

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
			for (var j = 0; j < MAX_MESSAGES_PER_CONVERSATION && conversation.length; j++) {
				ul.append(JSON.stringify(conversation[j]));
			}
			ul.append('</li>');
		}
	}

	$(window).bind('storage', function() {
		console.log("Got localStorage update");
		fillMessages();
	});
	fillMessages();
}
