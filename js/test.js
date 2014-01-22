// Setup dumb test wrapper
var testsdiv = $('#tests');
function TEST(func, name) {
	var funcName = name === undefined ? func + "" : name;
	try {
		if (func())
			testsdiv.append('<p style="color: green;">' + funcName + ' passed</p>');
		else
			testsdiv.append('<p style="color: red;">' + funcName + ' returned false</p>');
	} catch (e) {
			testsdiv.append('<p style="color: red;">' + funcName + ' threw ' + e + '</p>');
	}
}

// Random tests to check my JS knowledge
TEST(function() { return !objectContainsKeys({}); });
TEST(function() { return objectContainsKeys({ a: undefined }); });
TEST(function() { return objectContainsKeys({ a: null }); });

// Basic sanity-checks on the crypto library
TEST(function() {
	var PushMessageProto = dcodeIO.ProtoBuf.loadProtoFile("IncomingPushMessageSignal.proto").build("textsecure.PushMessageContent");
	var IncomingMessageProto = dcodeIO.ProtoBuf.loadProtoFile("IncomingPushMessageSignal.proto").build("textsecure.IncomingPushMessageSignal");

	var text_message = new PushMessageProto();
	text_message.body = "Hi Mom";
	var server_message = {type: 0, // unencrypted
					source: "+19999999999", timestamp: 42, message: text_message.encode() };

	crypto.handleIncomingPushMessageProto(server_message);
	return server_message.message.body == text_message.body &&
			server_message.message.attachments.length == text_message.attachments.length &&
			text_message.attachments.length == 0;
}, 'Unencrypted PushMessageProto "decrypt"');

// TODO: Run through the test vectors for the axolotl ratchet

