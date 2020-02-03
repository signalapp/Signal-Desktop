import React from 'react';

import { Emojify } from './Emojify';
import { Intl } from '../Intl';
import { LocalizerType } from '../../types/Util';

interface Props {
  phoneNumber?: string;
  name?: string;
  profileName?: string;
  module?: string;
  isMe?: boolean;
  i18n?: LocalizerType;
}

export class ContactName extends React.Component<Props> {
  public render() {
    const { phoneNumber, name, profileName, module, isMe, i18n } = this.props;
    const prefix = module ? module : 'module-contact-name';

    const title = name ? name : phoneNumber;
    const shouldShowProfile = Boolean(profileName && !name);
    const profileElement = shouldShowProfile ? (
      <span className={`${prefix}__profile-name`}>
        ~<Emojify text={profileName || ''} />
      </span>
    ) : null;

    const fragment = (
      <>
        <Emojify text={title} />
        {shouldShowProfile ? ' ' : null}
        {profileElement}
      </>
    );

    return (
      <span className={prefix} dir="auto">
        {isMe ? (
          <Intl i18n={i18n} id="ContactName--you" components={[fragment]} />
        ) : (
          fragment
        )}
      </span>
    );
  }
}
