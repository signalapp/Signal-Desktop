import React from 'react';
// import classNames from 'classnames';

import { ContactName } from './ContactName';
import { Intl } from '../Intl';
import { LocalizerType } from '../../types/Util';

interface ContactType {
  id: string;
  phoneNumber: string;
  profileName?: string;
  name?: string;
}

export type PropsData = {
  isGroup: boolean;
  contact: ContactType;
};

type PropsHousekeeping = {
  i18n: LocalizerType;
};

export type PropsActions = {
  showIdentity: (id: string) => void;
};

type Props = PropsData & PropsHousekeeping & PropsActions;

export class SafetyNumberNotification extends React.Component<Props> {
  public render() {
    const { contact, isGroup, i18n, showIdentity } = this.props;
    const changeKey = isGroup
      ? 'safetyNumberChangedGroup'
      : 'safetyNumberChanged';

    return (
      <div className="module-safety-number-notification">
        <div className="module-safety-number-notification__icon" />
        <div className="module-safety-number-notification__text">
          <Intl
            id={changeKey}
            components={[
              <span
                key="external-1"
                className="module-safety-number-notification__contact"
              >
                <ContactName
                  name={contact.name}
                  profileName={contact.profileName}
                  phoneNumber={contact.phoneNumber}
                  module="module-safety-number-notification__contact"
                />
              </span>,
            ]}
            i18n={i18n}
          />
        </div>
        <div
          role="button"
          onClick={() => {
            showIdentity(contact.id);
          }}
          className="module-safety-number-notification__button"
        >
          {i18n('verifyNewNumber')}
        </div>
      </div>
    );
  }
}
