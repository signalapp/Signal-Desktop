// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { ConversationType } from '../../state/ducks/conversations.preload.ts';
import type { LocalizerType } from '../../types/Util.std.ts';
import { isAccessControlEnabled } from '../../groups/util.std.ts';

import { ConfirmationDialog } from '../ConfirmationDialog.dom.tsx';
import { I18n } from '../I18n.dom.tsx';
import { ContactName } from './ContactName.dom.tsx';

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
}: PropsType): React.JSX.Element {
  const accessControlEnabled = isAccessControlEnabled(
    group.accessControlAddFromInviteLink
  );

  const contactName = <ContactName title={conversation.title} />;

  return (
    <ConfirmationDialog
      dialogName="RemoveGroupMemberConfirmationDialog"
      actions={[
        {
          action: onRemove,
          text: i18n('icu:RemoveGroupMemberConfirmation__remove-button'),
          style: 'negative',
        },
      ]}
      i18n={i18n}
      onClose={onClose}
      title={
        accessControlEnabled ? (
          <I18n
            i18n={i18n}
            id="icu:RemoveGroupMemberConfirmation__description__with-link"
            components={{ name: contactName }}
          />
        ) : (
          <I18n
            i18n={i18n}
            id="icu:RemoveGroupMemberConfirmation__description"
            components={{ name: contactName }}
          />
        )
      }
    />
  );
}
