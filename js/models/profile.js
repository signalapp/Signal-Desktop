/* global storage, _ */
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
    const storedProfile = profiles[number];

    // Only store the profile if we have a different object
    if (storedProfile && _.isEqual(storedProfile, profile)) {
      return;
    }

    window.log.info('adding profile ', profile, 'for ', number);
    await storage.put(PROFILE_ID, {
      ...profiles,
      [number]: profile,
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

  // Names that user can set for users

  const NICKNAME_ID = 'nickname';

  storage.getNickname = number => {
    const nicknames = storage.get(NICKNAME_ID, {});
    return nicknames[number] || null;
  }

  storage.saveNickname = async (number, name) => {
    const nicknames = storage.get(NICKNAME_ID, {});
    const storedName = nicknames[number];

    // Only store the name if we have a different name
    if (storedName === name) {
      return;
    }

    window.log.info('adding nickname ', name, 'for ', number);
    await storage.put(NICKNAME_ID, {
      ...nicknames,
      [number]: name,
    });
  }

  storage.removeNickname = async number => {
    const nicknames = storage.get(NICKNAME_ID, {});
    if (!nicknames[number]) {
      return;
    }

    delete nicknames[number];

    window.log.info('removing nickname for ', number);
    await storage.put(NICKNAME_ID, nicknames);
  }
})();
