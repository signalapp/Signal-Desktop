import React from 'react';

import { Emojify } from './Emojify';

import { LocalizerType } from '../../types/Util';

interface Props {
  phoneNumber: string;
  name?: string;
  profileName?: string;
  i18n: LocalizerType;
  module?: string;
}

export class ContactName extends React.Component<Props> {
  public render() {
    const { phoneNumber, name, profileName, i18n, module } = this.props;
    const prefix = module ? module : 'module-contact-name';

    const title = name ? name : phoneNumber;
    const shouldShowProfile = Boolean(profileName && !name);
    const profileElement = shouldShowProfile ? (
      <span className={`${prefix}__profile-name`}>
        <Emojify text={profileName || ''} i18n={i18n} />
      </span>
    ) : null;

    return (
      <span className={prefix} dir="auto">
        {profileElement}
        {shouldShowProfile ? ' ' : null}
        <Emojify text={title} i18n={i18n} />
      </span>
    );
  }
}
