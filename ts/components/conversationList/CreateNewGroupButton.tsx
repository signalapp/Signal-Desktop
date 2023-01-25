// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FunctionComponent } from 'react';
import React from 'react';

import type { LocalizerType } from '../../types/Util';
import { ListTile } from '../ListTile';
import { Avatar, AvatarSize } from '../Avatar';

type PropsType = {
  i18n: LocalizerType;
  onClick: () => void;
};

export const CreateNewGroupButton: FunctionComponent<PropsType> = React.memo(
  function CreateNewGroupButton({ i18n, onClick }) {
    const title = i18n('createNewGroupButton');

    return (
      <ListTile
        testId="CreateNewGroupButton"
        leading={
          <Avatar
            acceptedMessageRequest={false}
            conversationType="group"
            i18n={i18n}
            isMe={false}
            title={title}
            sharedGroupNames={[]}
            size={AvatarSize.THIRTY_TWO}
            badge={undefined}
          />
        }
        title={title}
        onClick={onClick}
      />
    );
  }
);
