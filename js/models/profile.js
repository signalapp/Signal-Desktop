/* global storage, _ */
/* global storage: false */

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  const PROFILE_ID = 'local-profile';

  storage.getLocalProfile = () => {
    const profile = storage.get(PROFILE_ID, null);
    return profile;
  }

  storage.saveLocalProfile = async (profile) => {
    const storedProfile = storage.get(PROFILE_ID, null);

    // Only store the profile if we have a different object
    if (storedProfile && _.isEqual(storedProfile, profile)) {
      return;
    }

    window.log.info('saving local profile ', profile);
    await storage.put(PROFILE_ID, profile);
  }

  storage.removeLocalProfile = async () => {
    window.log.info('removing local profile');
    await storage.remove(PROFILE_ID);
  }
})();
