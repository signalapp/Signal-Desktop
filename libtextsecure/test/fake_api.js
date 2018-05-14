var getKeysForNumberMap = {};
TextSecureServer.getKeysForNumber = function(number, deviceId) {
  var res = getKeysForNumberMap[number];
  if (res !== undefined) {
    delete getKeysForNumberMap[number];
    return Promise.resolve(res);
  } else throw new Error('getKeysForNumber of unknown/used number');
};

var messagesSentMap = {};
TextSecureServer.sendMessages = function(destination, messageArray) {
  for (i in messageArray) {
    var msg = messageArray[i];
    if (
      (msg.type != 1 && msg.type != 3) ||
      msg.destinationDeviceId === undefined ||
      msg.destinationRegistrationId === undefined ||
      msg.body === undefined ||
      msg.timestamp == undefined ||
      msg.relay !== undefined ||
      msg.destination !== undefined
    )
      throw new Error('Invalid message');

    messagesSentMap[
      destination + '.' + messageArray[i].destinationDeviceId
    ] = msg;
  }
};
