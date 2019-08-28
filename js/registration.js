/* global storage, Whisper */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  Whisper.Registration = {
    markEverDone() {
      storage.put('chromiumRegistrationDoneEver', '');
    },
    markDone() {
      this.markEverDone();
      storage.put('chromiumRegistrationDone', '');
    },
    isDone() {
      return storage.get('chromiumRegistrationDone') === '';
    },
    everDone() {
      return (
        storage.get('chromiumRegistrationDoneEver') === '' ||
        storage.get('chromiumRegistrationDone') === ''
      );
    },
    ongoingSecondaryDeviceRegistration() {
      return storage.get('secondaryDeviceStatus') === 'ongoing';
    },
    remove() {
      storage.remove('chromiumRegistrationDone');
    },
  };
})();
