// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback } from 'react';

import type { LocalizerType } from '../../types/Util';
import type { ConversationType } from '../../state/ducks/conversations';
import { SystemMessage } from './SystemMessage';
import { Emojify } from './Emojify';
import type { ProfileNameChangeType } from '../../util/getStringForProfileChange';
import { getStringForProfileChange } from '../../util/getStringForProfileChange';
import { Button, ButtonSize, ButtonVariant } from '../Button';

export type PropsType = {
  change: ProfileNameChangeType;
  changedContact: ConversationType;
  i18n: LocalizerType;
  onOpenEditNicknameAndNoteModal: (contactId: string) => void;
};

export function ProfileChangeNotification({
  change,
  changedContact,
  i18n,
  onOpenEditNicknameAndNoteModal,
}: PropsType): JSX.Element {
  const message = getStringForProfileChange(change, changedContact, i18n);
  const { id: contactId } = changedContact;

  const handleOpenEditNicknameAndNoteModal = useCallback(() => {
    onOpenEditNicknameAndNoteModal(contactId);
  }, [contactId, onOpenEditNicknameAndNoteModal]);

  return (
    <SystemMessage
      icon="profile"
      contents={<Emojify text={message} />}
      button={
        (changedContact.nicknameGivenName != null ||
          changedContact.nicknameFamilyName != null) && (
          <Button
            onClick={handleOpenEditNicknameAndNoteModal}
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
