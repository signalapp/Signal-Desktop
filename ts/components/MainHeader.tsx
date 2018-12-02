import React from 'react';

import { Avatar } from './Avatar';
import { ContactName } from './conversation/ContactName';

import { Localizer } from '../types/Util';

interface Props {
  phoneNumber: string;
  isMe?: boolean;
  name?: string;
  color?: string;
  verified: boolean;
  profileName?: string;
  avatarPath?: string;
  i18n: Localizer;
  onClick?: () => void;
}

export class MainHeader extends React.Component<Props> {
  public render() {
    const {
      avatarPath,
      i18n,
      color,
      name,
      phoneNumber,
      profileName,
      onClick
    } = this.props;

    return (
      <div role='button' className="module-main-header" onClick={onClick}>
        <Avatar
          avatarPath={avatarPath}
          color={color}
          conversationType="direct"
          i18n={i18n}
          name={name}
          phoneNumber={phoneNumber}
          profileName={profileName}
          size={28}
        />
        <div className="module-main-header__contact-name">
          <ContactName
            phoneNumber={phoneNumber}
            profileName={profileName}
            i18n={i18n}
          />
        </div>
        <div
          className="module-main-header__expand-icon"
        />
      </div>
    );
  }
}
