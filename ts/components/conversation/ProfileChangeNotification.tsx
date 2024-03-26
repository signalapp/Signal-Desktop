// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { LocalizerType } from '../../types/Util';
import type { ConversationType } from '../../state/ducks/conversations';
import { SystemMessage } from './SystemMessage';
import { Emojify } from './Emojify';
import type { ProfileNameChangeType } from '../../util/getStringForProfileChange';
import { getStringForProfileChange } from '../../util/getStringForProfileChange';
import { Button, ButtonSize, ButtonVariant } from '../Button';
import { areNicknamesEnabled } from '../../util/nicknames';

export type PropsType = {
  change: ProfileNameChangeType;
  changedContact: ConversationType;
  i18n: LocalizerType;
  onOpenEditNicknameAndNoteModal: () => void;
};

export function ProfileChangeNotification({
  change,
  changedContact,
  i18n,
  onOpenEditNicknameAndNoteModal,
}: PropsType): JSX.Element {
  const message = getStringForProfileChange(change, changedContact, i18n);

  return (
    <SystemMessage
      icon="profile"
      contents={<Emojify text={message} />}
      button={
        areNicknamesEnabled() &&
        changedContact.nicknameGivenName != null && (
          <Button
            onClick={onOpenEditNicknameAndNoteModal}
            size={ButtonSize.Small}
            variant={ButtonVariant.SystemMessage}
          >
            {i18n('icu:update')}
          </Button>
        )
      }
    />
  );
}
