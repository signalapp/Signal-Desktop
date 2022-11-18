// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { ConversationType } from '../../state/ducks/conversations';
import type { LocalizerType } from '../../types/Util';
import { isAccessControlEnabled } from '../../groups/util';

import { ConfirmationDialog } from '../ConfirmationDialog';
import { Intl } from '../Intl';
import { ContactName } from './ContactName';

type PropsType = {
  group: ConversationType;
  conversation: ConversationType;
  i18n: LocalizerType;
  onClose: () => void;
  onRemove: () => void;
};

export function RemoveGroupMemberConfirmationDialog({
  conversation,
  group,
  i18n,
  onClose,
  onRemove,
}: PropsType): JSX.Element {
  const descriptionKey = isAccessControlEnabled(
    group.accessControlAddFromInviteLink
  )
    ? 'RemoveGroupMemberConfirmation__description__with-link'
    : 'RemoveGroupMemberConfirmation__description';

  return (
    <ConfirmationDialog
      dialogName="RemoveGroupMemberConfirmationDialog"
      actions={[
        {
          action: onRemove,
          text: i18n('RemoveGroupMemberConfirmation__remove-button'),
          style: 'negative',
        },
      ]}
      i18n={i18n}
      onClose={onClose}
      title={
        <Intl
          i18n={i18n}
          id={descriptionKey}
          components={{
            name: <ContactName title={conversation.title} />,
          }}
        />
      }
    />
  );
}
