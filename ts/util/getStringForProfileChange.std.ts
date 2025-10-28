// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LocalizerType } from '../types/Util.std.js';

export type ProfileNameChangeType = {
  type: 'name';
  oldName: string;
  newName: string;
};
type ContactType = {
  title: string;
  name?: string;
};

export function getStringForProfileChange(
  change: ProfileNameChangeType,
  changedContact: ContactType,
  i18n: LocalizerType
): string {
  if (change.type === 'name') {
    return changedContact.name
      ? i18n('icu:contactChangedProfileName', {
          sender: changedContact.title,
          oldProfile: change.oldName,
          newProfile: change.newName,
        })
      : i18n('icu:changedProfileName', {
          oldProfile: change.oldName,
          newProfile: change.newName,
        });
  }

  throw new Error('TimelineItem: Unknown type!');
}
