// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isBucketValueEnabled, isEnabled } from '../RemoteConfig';
import { UUIDKind } from '../types/UUID';
import { isBeta } from './version';

// Note: selectors/items is the other place this check is done
export const getStoriesAvailable = (): boolean => {
  if (
    isBucketValueEnabled(
      'desktop.stories',
      window.textsecure.storage.user.getNumber(),
      window.textsecure.storage.user.getUuid(UUIDKind.ACI)?.toString()
    )
  ) {
    return true;
  }

  if (isEnabled('desktop.internalUser')) {
    return true;
  }

  if (isEnabled('desktop.stories.beta') && isBeta(window.getVersion())) {
    return true;
  }

  return false;
};

export const getStoriesDisabled = (): boolean =>
  window.Events.getHasStoriesDisabled();

export const getStoriesBlocked = (): boolean =>
  !getStoriesAvailable() || getStoriesDisabled();
