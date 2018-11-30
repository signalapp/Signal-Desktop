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

  storage.setProfileName = async (newName) => {
    // Update our profiles accordingly'
    const trimmed = newName && newName.trim();

    // If we get an empty name then unset the name property
    // Otherwise update it
    const profile = storage.getLocalProfile();
    const newProfile = profile || {};
    if (_.isEmpty(trimmed)) {
      delete newProfile.name;
    } else {
      newProfile.name = {
        displayName: trimmed,
      }
    }

    await storage.saveLocalProfile(newProfile);
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
