if (localStorage.getItem('first_install_ran')) {
	localStorage.setItem('first_install_ran', 1);
	chrome.tabs.create({url: "options.html"});
} else {
	if (isRegistrationDone()) {
		subscribeToPush(function(message) {
			console.log("Got message from " + message.source + ": \"" + getString(message.message));
			storeMessage(message);
		});
	}
}
