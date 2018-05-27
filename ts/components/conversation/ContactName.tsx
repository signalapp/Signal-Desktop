import React from 'react';

import { Emojify } from './Emojify';

import { Localizer } from '../../types/Util';

interface Props {
  phoneNumber: string;
  name?: string;
  profileName?: string;
  i18n: Localizer;
}

export class ContactName extends React.Component<Props> {
  public render() {
    const { phoneNumber, name, profileName, i18n } = this.props;

    const title = name ? name : phoneNumber;
    const profileElement =
      profileName && !name ? (
        <span className="profile-name">
          ~<Emojify text={profileName} i18n={i18n} />
        </span>
      ) : null;

    return (
      <span>
        <Emojify text={title} i18n={i18n} /> {profileElement}
      </span>
    );
  }
}
