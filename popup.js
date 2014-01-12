$('#inbox_link').onclick = function() {
	$('#inbox').style('display: none;'); $('#send').style('display: block;');
}
$('#send_link').onclick = function() {
	$('#send').style('display: block;'); $('#send').style('display: none;');
}

if (storage.getUnencrypted("number_id") === undefined)
	chrome.tabs.create({url: "options.html"});
else {
	subscribeToPush(function(message) {
		console.log("GOT MESSAGE IN POPUP! " + message);
	});
}
