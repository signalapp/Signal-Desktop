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
  const accessControlEnabled = isAccessControlEnabled(
    group.accessControlAddFromInviteLink
  );

  const intlComponents = {
    name: <ContactName title={conversation.title} />,
  };

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
        accessControlEnabled ? (
          <Intl
            i18n={i18n}
            id="RemoveGroupMemberConfirmation__description__with-link"
            components={intlComponents}
          />
        ) : (
          <Intl
            i18n={i18n}
            id="RemoveGroupMemberConfirmation__description"
            components={intlComponents}
          />
        )
      }
    />
  );
}
