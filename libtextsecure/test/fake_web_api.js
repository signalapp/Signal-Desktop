window.setImmediate = window.nodeSetImmediate;

const getKeysForNumberMap = {};
const messagesSentMap = {};

const fakeCall = () => Promise.resolve();

const fakeAPI = {
  confirmCode: fakeCall,
  getAttachment: fakeCall,
  getAvatar: fakeCall,
  getDevices: fakeCall,
  // getKeysForNumber: fakeCall,
  getMessageSocket: fakeCall,
  getMyKeys: fakeCall,
  getProfile: fakeCall,
  getProvisioningSocket: fakeCall,
  putAttachment: fakeCall,
  registerKeys: fakeCall,
  requestVerificationSMS: fakeCall,
  requestVerificationVoice: fakeCall,
  // sendMessages: fakeCall,
  setSignedPreKey: fakeCall,

  getKeysForNumber(number) {
    const res = getKeysForNumberMap[number];
    if (res !== undefined) {
      delete getKeysForNumberMap[number];
      return Promise.resolve(res);
    }
    throw new Error('getKeysForNumber of unknown/used number');
  },

  sendMessages(destination, messageArray) {
    for (let i = 0, max = messageArray.length; i < max; i += 1) {
      const msg = messageArray[i];
      if (
        (msg.type !== 1 && msg.type !== 3) ||
        msg.destinationDeviceId === undefined ||
        msg.destinationRegistrationId === undefined ||
        msg.body === undefined ||
        msg.timestamp === undefined ||
        msg.relay !== undefined ||
        msg.destination !== undefined
      ) {
        throw new Error('Invalid message');
      }

      messagesSentMap[
        `${destination}.${messageArray[i].destinationDeviceId}`
      ] = msg;
    }
  },
};

window.WebAPI = {
  connect: () => fakeAPI,
};
