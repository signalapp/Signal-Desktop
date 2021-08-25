// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { FunctionComponent } from 'react';

import { ConversationType } from '../../state/ducks/conversations';
import { LocalizerType } from '../../types/Util';

import { ConfirmationDialog } from '../ConfirmationDialog';
import { Intl } from '../Intl';
import { ContactName } from './ContactName';

type PropsType = {
  conversation: ConversationType;
  i18n: LocalizerType;
  onClose: () => void;
  onRemove: () => void;
};

export const RemoveGroupMemberConfirmationDialog: FunctionComponent<PropsType> = ({
  conversation,
  i18n,
  onClose,
  onRemove,
}) => (
  <ConfirmationDialog
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
        id="RemoveGroupMemberConfirmation__description"
        components={{
          name: (
            <ContactName
              firstName={conversation.firstName}
              i18n={i18n}
              title={conversation.title}
            />
          ),
        }}
      />
    }
  />
);
