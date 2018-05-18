import React from 'react';

import { Emojify } from './Emojify';

interface Props {
  phoneNumber: string;
  name?: string;
  profileName?: string;
}

export class ContactName extends React.Component<Props, {}> {
  public render() {
    const { phoneNumber, name, profileName } = this.props;

    const title = name ? name : phoneNumber;
    const profileElement =
      profileName && !name ? (
        <span className="profile-name">
          ~<Emojify text={profileName} />
        </span>
      ) : null;

    return (
      <span>
        <Emojify text={title} /> {profileElement}
      </span>
    );
  }
}
