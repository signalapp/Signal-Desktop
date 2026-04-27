// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback } from 'react';

import type { LocalizerType } from '../../types/Util.std.ts';
import type { ConversationType } from '../../state/ducks/conversations.preload.ts';
import { SystemMessage } from './SystemMessage.dom.tsx';
import { Emojify } from './Emojify.dom.tsx';
import type { ProfileNameChangeType } from '../../util/getStringForProfileChange.std.ts';
import { getStringForProfileChange } from '../../util/getStringForProfileChange.std.ts';
import { Button, ButtonSize, ButtonVariant } from '../Button.dom.tsx';

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
}: PropsType): React.JSX.Element {
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
