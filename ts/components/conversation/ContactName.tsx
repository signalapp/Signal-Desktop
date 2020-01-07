import React from 'react';

import { Emojify } from './Emojify';

interface Props {
  phoneNumber: string;
  name?: string;
  profileName?: string;
  module?: string;
}

export class ContactName extends React.Component<Props> {
  public render() {
    const { phoneNumber, name, profileName, module } = this.props;
    const prefix = module ? module : 'module-contact-name';

    const title = name ? name : phoneNumber;
    const shouldShowProfile = Boolean(profileName && !name);
    const profileElement = shouldShowProfile ? (
      <span className={`${prefix}__profile-name`}>
        ~<Emojify text={profileName || ''} />
      </span>
    ) : null;

    return (
      <span className={prefix} dir="auto">
        <Emojify text={title} />
        {shouldShowProfile ? ' ' : null}
        {profileElement}
      </span>
    );
  }
}
