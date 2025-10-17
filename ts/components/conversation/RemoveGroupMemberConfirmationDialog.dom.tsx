// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { ConversationType } from '../../state/ducks/conversations.preload.js';
import type { LocalizerType } from '../../types/Util.std.js';
import { isAccessControlEnabled } from '../../groups/util.std.js';

import { ConfirmationDialog } from '../ConfirmationDialog.dom.js';
import { I18n } from '../I18n.dom.js';
import { ContactName } from './ContactName.dom.js';

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
