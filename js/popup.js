$('#inbox_link').click(function() {
	$('#inbox').show();
	$('#send').hide();
});
$('#send_link').click(function() {
	$('#inbox').hide();
	$('#send').show();
});

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

			var ul = $('#conversations');
			ul.html('');
			for (var i = 0; i < MAX_CONVERSATIONS && i < conversations.length; i++) {
				var conversation = conversations[i];
				var messages = $('<ul class="conversation">');
				for (var j = 0; j < MAX_MESSAGES_PER_CONVERSATION && j < conversation.length; j++) {
					var message = conversation[j];
					$('<li class="message incoming">').
						append($('<div class="avatar">')).
						append($('<div class="bubble">').
							append($('<span class="message-text">').text(message.message)).
							append($('<span class="metadata">').text("From: " + message.sender + ", at: " + timestampToHumanReadable(message.timestamp)))
						).appendTo(messages);
				}
				$('<li>').
					append(messages).
					append($("<form class='container'>").
						append("<input type='text' id=text" + i + " /><button id=button" + i + ">Send</button><br>")
					).appendTo(ul);
				$('#button' + i).click(function() {
					var sendDestinations = [conversation[0].sender];
					if (conversation[0].group) {
							sendDestinations = conversation[0].group.members;
					}

					var messageProto = new PushMessageContentProtobuf();
					messageProto.body = $('#text' + i).val();

					sendMessageToNumbers(sendDestinations, messageProto, function(result) {
						console.log("Sent message: " + result);
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
			sendMessageToNumbers(numbers, messageProto,
				//TODO: Handle result
				function(thing) {console.log(thing);});
		});
	}
});
