import React from 'react';
// import classNames from 'classnames';

import { ContactName } from './ContactName';
import { Intl } from '../Intl';

import { missingCaseError } from '../../util/missingCaseError';

interface Contact {
  phoneNumber: string;
  profileName?: string;
  name?: string;
}

type Props = {
  // tslint:disable: react-unused-props-and-state
  type: 'markVerified' | 'markNotVerified';
  isLocal: boolean;
  contact: Contact;
};

export const VerificationNotification = (props: Props) => {
  const { type } = props;
  const suffix =
    type === 'markVerified' ? 'mark-verified' : 'mark-not-verified';

  const getStringId = () => {
    const { isLocal } = props;

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
  };

  const renderContents = () => {
    const { contact } = props;
    const { i18n } = window;
    const id = getStringId();

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
            shouldShowPubkey={true}
          />,
        ]}
        i18n={i18n}
      />
    );
  };

  return (
    <div className="module-verification-notification">
      <div className={`module-verification-notification__icon--${suffix}`} />
      {renderContents()}
    </div>
  );
};
