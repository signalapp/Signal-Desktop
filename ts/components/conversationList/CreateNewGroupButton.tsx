// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { CSSProperties, FunctionComponent } from 'react';

import { BaseConversationListItem } from './BaseConversationListItem';
import { LocalizerType } from '../../types/Util';

type PropsType = {
  i18n: LocalizerType;
  onClick: () => void;
  style: CSSProperties;
};

export const CreateNewGroupButton: FunctionComponent<PropsType> = React.memo(
  ({ i18n, onClick, style }) => {
    const title = i18n('createNewGroupButton');

    return (
      <BaseConversationListItem
        color="grey"
        conversationType="group"
        headerName={title}
        i18n={i18n}
        isSelected={false}
        onClick={onClick}
        style={style}
        title={title}
      />
    );
  }
);
