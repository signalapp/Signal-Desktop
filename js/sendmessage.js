// sendMessage(numbers = [], message = PushMessageContentProto, callback(success/failure map))
window.textsecure.messaging = function() {
	var self = {};

	function getKeysForNumber(number, updateDevices) {
		return textsecure.api.getKeysForNumber(number).then(function(response) {
			var identityKey = getString(response[0].identityKey);
			for (i in response)
				if (getString(response[i].identityKey) != identityKey)
					throw new Error("Identity key not consistent");

			for (i in response) {
				if (updateDevices === undefined || updateDevices.indexOf(response[i].deviceId) > -1)
					textsecure.storage.devices.saveDeviceObject({
						encodedNumber: number + "." + response[i].deviceId,
						identityKey: response[i].identityKey,
						publicKey: response[i].publicKey,
						preKeyId: response[i].keyId,
						registrationId: response[i].registrationId
					});
			}
		});
	}

	// success_callback(server success/failure map), error_callback(error_msg)
	// message == PushMessageContentProto (NOT STRING)
	function sendMessageToDevices(number, deviceObjectList, message, success_callback, error_callback) {
		var jsonData = [];
		var relay = undefined;
		var promises = [];

		var addEncryptionFor = function(i) {
			if (deviceObjectList[i].relay !== undefined) {
				if (relay === undefined)
					relay = deviceObjectList[i].relay;
				else if (relay != deviceObjectList[i].relay)
					return new Promise(function() { throw new Error("Mismatched relays for number " + number); });
			} else {
				if (relay === undefined)
					relay = "";
				else if (relay != "")
					return new Promise(function() { throw new Error("Mismatched relays for number " + number); });
			}

			return textsecure.crypto.encryptMessageFor(deviceObjectList[i], message).then(function(encryptedMsg) {
				jsonData[i] = {
					type: encryptedMsg.type,
					destinationDeviceId: textsecure.utils.unencodeNumber(deviceObjectList[i].encodedNumber)[1],
					destinationRegistrationId: deviceObjectList[i].registrationId,
					body: encryptedMsg.body,
					timestamp: new Date().getTime()
				};

				if (deviceObjectList[i].relay !== undefined)
					jsonData[i].relay = deviceObjectList[i].relay;
			});
		}

		for (var i = 0; i < deviceObjectList.length; i++)
			promises[i] = addEncryptionFor(i);
		return Promise.all(promises).then(function() {
			return textsecure.api.sendMessages(number, jsonData);
		});
	}

	var tryMessageAgain = function(number, encodedMessage, callback) {
		//TODO: Wipe identity key!
		//TODO: refresh groups
		var message = textsecure.protos.decodePushMessageContentProtobuf(encodedMessage);
		textsecure.sendMessage([number], message, callback);
	}
	textsecure.replay.registerReplayFunction(tryMessageAgain, textsecure.replay.SEND_MESSAGE);

	var sendMessageProto = function(numbers, message, callback) {
		var numbersCompleted = 0;
		var errors = [];
		var successfulNumbers = [];

		var numberCompleted = function() {
			numbersCompleted++;
			if (numbersCompleted >= numbers.length)
				callback({success: successfulNumbers, failure: errors});
		}

		var registerError = function(number, message, error) {
			if (error.humanError)
				message = error.humanError;
			errors[errors.length] = { number: number, reason: message, error: error };
			numberCompleted();
		}

		var doSendMessage;
		var reloadDevicesAndSend = function(number, recurse) {
			return function() {
				var devicesForNumber = textsecure.storage.devices.getDeviceObjectsForNumber(number);
				if (devicesForNumber.length == 0)
					return registerError(number, "Go empty device list when loading device keys", null);
				//TODO: Refresh groups
				doSendMessage(number, devicesForNumber, recurse);
			}
		}

		doSendMessage = function(number, devicesForNumber, recurse) {
			return sendMessageToDevices(number, devicesForNumber, message).then(function(result) {
				successfulNumbers[successfulNumbers.length] = number;
				numberCompleted();
			}).catch(function(error) {
				if (error instanceof Error && error.name == "HTTPError" && (error.message == 410 || error.message == 409)) {
					if (!recurse)
						return registerError(number, "Hit retry limit attempting to reload device list", error);

					if (error.message == 409)
						textsecure.storage.devices.removeDeviceIdsForNumber(number, error.response.extraDevices);

					var resetDevices = ((error.message == 410) ? error.response.staleDevices : error.response.missingDevices);
					getKeysForNumber(number, resetDevices)
						.then(reloadDevicesAndSend(number, false))
						.catch(function(error) {
							if (error.message !== "Identity key changed")
								registerError(number, "Failed to reload device keys", error);
							else {
								error = textsecure.replay.createReplayableError("The destination's identity key has changed", "The identity of the destination has changed. This may be malicious, or the destination may have simply reinstalled TextSecure.",
										textsecure.replay.SEND_MESSAGE, [number, getString(message.encode())]);
								registerError(number, "Identity key changed", error);
							}
						});
				} else
					registerError(number, "Failed to create or send message", error);
			});
		}

		for (var i = 0; i < numbers.length; i++) {
			var number = numbers[i];
			var devicesForNumber = textsecure.storage.devices.getDeviceObjectsForNumber(number);

			if (devicesForNumber.length == 0) {
				getKeysForNumber(number)
					.then(reloadDevicesAndSend(number, true))
					.catch(function(error) {
						registerError(number, "Failed to retreive new device keys for number " + number, error);
					});
			} else
				doSendMessage(number, devicesForNumber, true);
		}
	}

	var makeAttachmentPointer = function(attachment) {
		var proto = new textsecure.protos.PushMessageContentProtobuf.AttachmentPointer();
		proto.key = textsecure.crypto.getRandomBytes(64);

		var iv = textsecure.crypto.getRandomBytes(16);
		return textsecure.crypto.encryptAttachment(attachment.data, proto.key, iv).then(function(encryptedBin) {
			return textsecure.api.putAttachment(encryptedBin).then(function(id) {
				proto.id = id;
				proto.contentType = attachment.contentType;
				return proto;
			});
		});
	}

	var sendIndividualProto = function(number, proto) {
		return new Promise(function(resolve, reject) {
			sendMessageProto([number], proto, function(res) {
				if (res.failure.length > 0)
					reject(res.failure[0].error);
				else
					resolve();
			});
		});
	}

	var sendGroupProto = function(numbers, proto) {
		var me = textsecure.utils.unencodeNumber(textsecure.storage.getUnencrypted("number_id"))[0];
		numbers = numbers.filter(function(number) { return number != me; });

		return new Promise(function(resolve, reject) {
			sendMessageProto(numbers, proto, function(res) {
				if (res.failure.length > 0)
					reject(res.failure);
				else
					resolve();
			});
		});
	}

	self.sendMessageToNumber = function(number, messageText, attachments) {
		var proto = new textsecure.protos.PushMessageContentProtobuf();
		proto.body = messageText;

		var promises = [];
		for (i in attachments)
			promises.push(makeAttachmentPointer(attachments[i]));
		return Promise.all(promises).then(function(attachmentsArray) {
			proto.attachments = attachmentsArray;
			return sendIndividualProto(number, proto);
		});
	}

	self.closeSession = function(number) {
		var devices = textsecure.storage.devices.getDeviceObjectsForNumber(number);
		for (i in devices)
			textsecure.crypto.closeOpenSessionForDevice(devices[i].encodedNumber);

		var proto = new textsecure.protos.PushMessageContentProtobuf();
		proto.flags = textsecure.protos.PushMessageContentProtobuf.Flags.END_SESSION;
		return sendIndividualProto(number, proto);
	}

	self.sendMessageToGroup = function(groupId, messageText, attachments) {
		var proto = new textsecure.protos.PushMessageContentProtobuf();
		proto.body = messageText;
		proto.group = new textsecure.protos.PushMessageContentProtobuf.GroupContext();
		proto.group.id = groupId;
		proto.group.type = textsecure.protos.PushMessageContentProtobuf.GroupContext.DELIVER;

		var numbers = textsecure.storage.groups.getNumbers(groupId);
		if (numbers === undefined)
			return new Promise(function(resolve, reject) { reject(new Error("Unknown Group")); });

		var promises = [];
		for (i in attachments)
			promises.push(makeAttachmentPointer(attachments[i]));
		return Promise.all(promises).then(function(attachmentsArray) {
			proto.attachments = attachmentsArray;
			return sendGroupProto(numbers, proto);
		});
	}

	self.createGroup = function(numbers, name, avatar) {
		var proto = new textsecure.protos.PushMessageContentProtobuf();
		proto.group = new textsecure.protos.PushMessageContentProtobuf.GroupContext();

		var group = textsecure.storage.groups.createNewGroup(numbers);
		proto.group.id = group.id;
		numbers = group.numbers;

		proto.group.type = textsecure.protos.PushMessageContentProtobuf.GroupContext.UPDATE;
		proto.group.members = numbers;
		proto.group.name = name;

		if (avatar !== undefined) {
			return makeAttachmentPointer(avatar).then(function(attachment) {
				proto.group.avatar = attachment;
				return sendGroupProto(numbers, proto).then(function() {
					return proto.group.id;
				});
			});
		} else {
			return sendGroupProto(numbers, proto).then(function() {
				return proto.group.id;
			});
		}
	}

	self.addNumberToGroup = function(groupId, number) {
		var proto = new textsecure.protos.PushMessageContentProtobuf();
		proto.group = new textsecure.protos.PushMessageContentProtobuf.GroupContext();
		proto.group.id = groupId;
		proto.group.type = textsecure.protos.PushMessageContentProtobuf.GroupContext.UPDATE;

		var numbers = textsecure.storage.groups.addNumber(groupId, number);
		if (numbers === undefined)
			return new Promise(function(resolve, reject) { reject(new Error("Unknown Group")); });
		proto.group.members = numbers;

		return sendGroupProto(numbers, proto);
	}

	self.setGroupName = function(groupId, name) {
		var proto = new textsecure.protos.PushMessageContentProtobuf();
		proto.group = new textsecure.protos.PushMessageContentProtobuf.GroupContext();
		proto.group.id = groupId;
		proto.group.type = textsecure.protos.PushMessageContentProtobuf.GroupContext.UPDATE;
		proto.group.name = name;

		var numbers = textsecure.storage.groups.getNumbers(groupId);
		if (numbers === undefined)
			return new Promise(function(resolve, reject) { reject(new Error("Unknown Group")); });
		proto.group.members = numbers;

		return sendGroupProto(numbers, proto);
	}

	self.setGroupAvatar = function(groupId, avatar) {
		var proto = new textsecure.protos.PushMessageContentProtobuf();
		proto.group = new textsecure.protos.PushMessageContentProtobuf.GroupContext();
		proto.group.id = groupId;
		proto.group.type = textsecure.protos.PushMessageContentProtobuf.GroupContext.UPDATE;

		var numbers = textsecure.storage.groups.getNumbers(groupId);
		if (numbers === undefined)
			return new Promise(function(resolve, reject) { reject(new Error("Unknown Group")); });
		proto.group.members = numbers;

		return makeAttachmentPointer(avatar).then(function(attachment) {
			proto.group.avatar = attachment;
			return sendGroupProto(numbers, proto);
		});
	}

	self.leaveGroup = function(groupId) {
		var proto = new textsecure.protos.PushMessageContentProtobuf();
		proto.group = new textsecure.protos.PushMessageContentProtobuf.GroupContext();
		proto.group.id = groupId;
		proto.group.type = textsecure.protos.PushMessageContentProtobuf.GroupContext.QUIT;

		var numbers = textsecure.storage.groups.getNumbers(groupId);
		if (numbers === undefined)
			return new Promise(function(resolve, reject) { reject(new Error("Unknown Group")); });
		textsecure.storage.groups.deleteGroup(groupId);

		return sendGroupProto(numbers, proto);
	}

	return self;
}();
