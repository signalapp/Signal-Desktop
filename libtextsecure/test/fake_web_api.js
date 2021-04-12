// Copyright 2018-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

window.setImmediate = window.nodeSetImmediate;

const getKeysForIdentifierMap = {};
const messagesSentMap = {};

const fakeCall = () => Promise.resolve();

const fakeAPI = {
  confirmCode: fakeCall,
  getAttachment: fakeCall,
  getAvatar: fakeCall,
  getDevices: fakeCall,
  // getKeysForIdentifier : fakeCall,
  getMessageSocket: () => new window.MockSocket('ws://localhost:8081/'),
  getMyKeys: fakeCall,
  getProfile: fakeCall,
  getProvisioningSocket: fakeCall,
  putAttachment: fakeCall,
  registerKeys: fakeCall,
  requestVerificationSMS: fakeCall,
  requestVerificationVoice: fakeCall,
  // sendMessages: fakeCall,
  setSignedPreKey: fakeCall,

  getKeysForIdentifier(number) {
    const res = getKeysForIdentifierMap[number];
    if (res !== undefined) {
      delete getKeysForIdentifierMap[number];
      return Promise.resolve(res);
    }
    throw new Error('getKeysForIdentfier of unknown/used number');
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
