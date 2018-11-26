/* global storage */
/* global storage: false */

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  const PROFILE_ID = 'profiles';

  storage.getProfile = number => {
    const profiles = storage.get(PROFILE_ID, {});
    return profiles[number] || null;
  }

  storage.saveProfile = async (number, profile) => {
    const profiles = storage.get(PROFILE_ID, {});
    if (profiles[number]) {
      return;
    }

    window.log.info('adding profile ', profile, 'for ', number);
    await storage.put(PROFILE_ID, {
      ...profiles,
      number: profile,
    });
  }

  storage.removeProfile = async number => {
    const profiles = storage.get(PROFILE_ID, {});
    if (!profiles[number]) {
      return;
    }

    delete profiles[number];

    window.log.info('removing profile for ', number);
    await storage.put(PROFILE_ID, profiles);
  }
})();
