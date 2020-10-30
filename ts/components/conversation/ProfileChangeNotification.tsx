// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { LocalizerType } from '../../types/Util';
import { ConversationType } from '../../state/ducks/conversations';
import { Emojify } from './Emojify';
import {
  getStringForProfileChange,
  ProfileNameChangeType,
} from '../../util/getStringForProfileChange';

export interface PropsType {
  change: ProfileNameChangeType;
  changedContact: ConversationType;
  i18n: LocalizerType;
}

export function ProfileChangeNotification(props: PropsType): JSX.Element {
  const { change, changedContact, i18n } = props;
  const message = getStringForProfileChange(change, changedContact, i18n);

  return (
    <div className="module-profile-change-notification">
      <div className="module-profile-change-notification--icon" />
      <Emojify text={message} />
    </div>
  );
}
