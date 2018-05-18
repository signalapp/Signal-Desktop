import React from 'react';

import { Emojify } from './Emojify';
import { Localizer } from '../../types/Util';

interface Props {
  i18n: Localizer;
  isVerified: boolean;
  name?: string;
  phoneNumber: string;
  profileName?: string;
}

export class ConversationTitle extends React.Component<Props, {}> {
  public render() {
    const { name, phoneNumber, i18n, profileName, isVerified } = this.props;

    return (
      <span className="conversation-title">
        {name ? (
          <span className="conversation-name" dir="auto">
            <Emojify text={name} />
          </span>
        ) : null}
        {phoneNumber ? (
          <span className="conversation-number">{phoneNumber}</span>
        ) : null}{' '}
        {profileName ? (
          <span className="profileName">
            <Emojify text={profileName} />
          </span>
        ) : null}
        {isVerified ? (
          <span className="verified">
            <span className="verified-icon" />
            {i18n('verified')}
          </span>
        ) : null}
      </span>
    );
  }
}
