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

    isSignInByLinking() {
      const isSignInByLinking = textsecure.storage.get('is_sign_in_by_linking');
      if (isSignInByLinking === undefined) {
        return false;
      }
      return isSignInByLinking;
    },

    setSignInByLinking(isLinking) {
      textsecure.storage.put('is_sign_in_by_linking', isLinking);
    },

    getLastProfileUpdateTimestamp() {
      return textsecure.storage.get('last_profile_update_timestamp');
    },

    setLastProfileUpdateTimestamp(lastUpdateTimestamp) {
      textsecure.storage.put(
        'last_profile_update_timestamp',
        lastUpdateTimestamp
      );
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
  };
})();
