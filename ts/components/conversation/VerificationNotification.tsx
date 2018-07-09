import React from 'react';
// import classNames from 'classnames';

import { ContactName } from './ContactName';
import { Intl } from '../Intl';
import { Localizer } from '../../types/Util';

import { missingCaseError } from '../../util/missingCaseError';

interface Contact {
  phoneNumber: string;
  profileName?: string;
  name?: string;
}

interface Props {
  type: 'markVerified' | 'markNotVerified';
  isLocal: boolean;
  contact: Contact;
  i18n: Localizer;
}

export class VerificationNotification extends React.Component<Props> {
  public getStringId() {
    const { isLocal, type } = this.props;

    switch (type) {
      case 'markVerified':
        return isLocal
          ? 'youMarkedAsVerified'
          : 'youMarkedAsVerifiedOtherDevice';
      case 'markNotVerified':
        return isLocal
          ? 'youMarkedAsNotVerified'
          : 'youMarkedAsNotVerifiedOtherDevice';
      default:
        throw missingCaseError(type);
    }
  }

  public renderContents() {
    const { contact, i18n } = this.props;
    const id = this.getStringId();

    return (
      <Intl
        id={id}
        components={[
          <ContactName
            i18n={i18n}
            key="external-1"
            name={contact.name}
            profileName={contact.profileName}
            phoneNumber={contact.phoneNumber}
            module="module-verification-notification__contact"
          />,
        ]}
        i18n={i18n}
      />
    );
  }

  public render() {
    const { type } = this.props;
    const suffix =
      type === 'markVerified' ? 'mark-verified' : 'mark-not-verified';

    return (
      <div className="module-verification-notification">
        <div className={`module-verification-notification__icon--${suffix}`} />
        {this.renderContents()}
      </div>
    );
  }
}
