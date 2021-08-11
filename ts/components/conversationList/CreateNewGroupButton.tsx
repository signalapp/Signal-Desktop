// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { FunctionComponent } from 'react';

import { BaseConversationListItem } from './BaseConversationListItem';
import { LocalizerType } from '../../types/Util';

type PropsType = {
  i18n: LocalizerType;
  onClick: () => void;
};

export const CreateNewGroupButton: FunctionComponent<PropsType> = React.memo(
  ({ i18n, onClick }) => {
    const title = i18n('createNewGroupButton');

    return (
      <BaseConversationListItem
        acceptedMessageRequest={false}
        conversationType="group"
        headerName={title}
        i18n={i18n}
        isMe={false}
        isSelected={false}
        onClick={onClick}
        sharedGroupNames={[]}
        title={title}
      />
    );
  }
);
