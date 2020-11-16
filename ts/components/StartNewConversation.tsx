// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { Avatar } from './Avatar';

import { LocalizerType } from '../types/Util';

export interface Props {
  phoneNumber: string;
  i18n: LocalizerType;
  onClick: () => void;
}

export class StartNewConversation extends React.PureComponent<Props> {
  public render(): JSX.Element {
    const { phoneNumber, i18n, onClick } = this.props;

    return (
      <button
        type="button"
        className="module-start-new-conversation"
        onClick={onClick}
      >
        <Avatar
          color="grey"
          conversationType="direct"
          i18n={i18n}
          title={phoneNumber}
          size={52}
        />
        <div className="module-start-new-conversation__content">
          <div className="module-start-new-conversation__number">
            {phoneNumber}
          </div>
          <div className="module-start-new-conversation__text">
            {i18n('startConversation')}
          </div>
        </div>
      </button>
    );
  }
}
