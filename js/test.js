// Setup dumb test wrapper
var testsdiv = $('#tests');
var testsOutstanding = [];
function TEST(func, name) {
	var funcName = name === undefined ? func + "" : name;
	var testIndex = testsOutstanding.length;
	function callback(result) {
		if (result)
			testsdiv.append('<p style="color: green;">' + funcName + ' passed</p>');
		else
			testsdiv.append('<p style="color: red;">' + funcName + ' returned false</p>');
		delete testsOutstanding[testIndex];
	}
	try {
		testsOutstanding[testIndex] = funcName;
		func(callback);
	} catch (e) {
			testsdiv.append('<p style="color: red;">' + funcName + ' threw ' + e + '</p>');
	}
}

registerOnLoadFunction(function() {
	localStorage.clear();

	// Random tests to check my JS knowledge
	TEST(function(callback) { callback(!objectContainsKeys({})); });
	TEST(function(callback) { callback(objectContainsKeys({ a: undefined })); });
	TEST(function(callback) { callback(objectContainsKeys({ a: null })); });

	// Basic sanity-checks on the crypto library
	TEST(function(callback) {
		var PushMessageProto = dcodeIO.ProtoBuf.loadProtoFile("protos/IncomingPushMessageSignal.proto").build("textsecure.PushMessageContent");
		var IncomingMessageProto = dcodeIO.ProtoBuf.loadProtoFile("protos/IncomingPushMessageSignal.proto").build("textsecure.IncomingPushMessageSignal");

		var text_message = new PushMessageProto();
		text_message.body = "Hi Mom";
		var server_message = {type: 0, // unencrypted
						source: "+19999999999", timestamp: 42, message: text_message.encode() };

		crypto.handleIncomingPushMessageProto(server_message, function(message) {
			callback(message.body == text_message.body &&
					message.attachments.length == text_message.attachments.length &&
					text_message.attachments.length == 0);
		});
	}, 'Unencrypted PushMessageProto "decrypt"');

	TEST(function(callback) {
		crypto.generateKeys(function() {
			callback(true);
		});
	}, "Test simple create key");

	// TODO: Run through the test vectors for the axolotl ratchet

	window.setTimeout(function() {
		for (var i = 0; i < testsOutstanding.length; i++)
			if (testsOutstanding[i] !== undefined)
				testsdiv.append('<p style="color: red;">' + testsOutstanding[i] + ' timed out</p>');

		localStorage.clear();
	}, 1000);
});
