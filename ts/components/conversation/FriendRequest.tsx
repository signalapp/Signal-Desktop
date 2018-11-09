import React from 'react';
// import classNames from 'classnames';

import { ContactName } from './ContactName';
import { Intl } from '../Intl';
import { Localizer } from '../../types/Util';

interface Contact {
  phoneNumber: string;
  profileName?: string;
  name?: string;
}

interface Props {
  type: 'incoming' | 'outgoing';
  source: Contact;
  target: Contact;
  i18n: Localizer;
  status: 'pending' | 'accepted' | 'declined';
}

export class FriendRequest extends React.Component<Props> {
  public getStringId() {
    const { status } = this.props;

    return 'youMarkedAsNotVerified';

    switch (status) {
      case 'pending':
        return 'friendRequestPending';
      case 'accepted':
        return 'friendRequestAccepted';
      case 'declined':
        return 'friendRequestDeclined'
      default:
        // throw missingCaseError(status);
    }
  }

  public renderContents() {
    const { source, i18n } = this.props;
    const id = this.getStringId();

    return (
      <Intl
        id={id}
        components={[
          <ContactName
            i18n={i18n}
            key="external-1"
            name={source.name}
            profileName={source.profileName}
            phoneNumber={source.phoneNumber}
            module="module-friend-request__contact"
          />,
        ]}
        i18n={i18n}
      />
    );
  }

  public render() {
    const { type } = this.props;

    return (
      <div className={`module-message module-message--${type}`}>
        <div className={`module-message__container module-message__container--${type}`}>
            <div className={`module-message__text module-message__text--${type}`}>
                {this.renderContents()}
            </div>
        </div>
      </div>
    );
  }
}
