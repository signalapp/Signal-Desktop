/* global textsecure, window */

// eslint-disable-next-line func-names
(function() {
  /** *******************************************
   *** Utilities to store data about the user ***
   ********************************************* */
  window.textsecure = window.textsecure || {};
  window.textsecure.storage = window.textsecure.storage || {};

  window.textsecure.storage.user = {
    setNumberAndDeviceId(number, deviceId, deviceName) {
      textsecure.storage.put('number_id', `${number}.${deviceId}`);
      if (deviceName) {
        textsecure.storage.put('device_name', deviceName);
      }
    },

    getNumber() {
      const numberId = textsecure.storage.get('number_id');
      if (numberId === undefined) {
        return undefined;
      }
      return textsecure.utils.unencodeNumber(numberId)[0];
    },

    getDeviceId() {
      const numberId = textsecure.storage.get('number_id');
      if (numberId === undefined) {
        return undefined;
      }
      return textsecure.utils.unencodeNumber(numberId)[1];
    },

    getDeviceName() {
      return textsecure.storage.get('device_name');
    },

    setDeviceNameEncrypted() {
      return textsecure.storage.put('deviceNameEncrypted', true);
    },

    getDeviceNameEncrypted() {
      return textsecure.storage.get('deviceNameEncrypted');
    },

    getSignalingKey() {
      return textsecure.storage.get('signaling_key');
    },
  };
})();
