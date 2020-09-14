import React from 'react';
// import classNames from 'classnames';

import { ContactName } from './ContactName';
import { Intl } from '../Intl';
import { LocalizerType } from '../../types/Util';

import { missingCaseError } from '../../util/missingCaseError';

interface Contact {
  phoneNumber?: string;
  profileName?: string;
  name?: string;
  title: string;
}

export type PropsData = {
  type: 'markVerified' | 'markNotVerified';
  isLocal: boolean;
  contact: Contact;
};

type PropsHousekeeping = {
  i18n: LocalizerType;
};

export type Props = PropsData & PropsHousekeeping;

export class VerificationNotification extends React.Component<Props> {
  public getStringId(): string {
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

  public renderContents(): JSX.Element {
    const { contact, i18n } = this.props;
    const id = this.getStringId();

    return (
      <Intl
        id={id}
        components={[
          <ContactName
            key="external-1"
            name={contact.name}
            profileName={contact.profileName}
            phoneNumber={contact.phoneNumber}
            title={contact.title}
            module="module-verification-notification__contact"
            i18n={i18n}
          />,
        ]}
        i18n={i18n}
      />
    );
  }

  public render(): JSX.Element {
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
