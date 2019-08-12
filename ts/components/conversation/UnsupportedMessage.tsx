import React from 'react';
import classNames from 'classnames';

import { ContactName } from './ContactName';
import { Intl } from '../Intl';
import { LocalizerType } from '../../types/Util';

interface ContactType {
  id: string;
  phoneNumber: string;
  profileName?: string;
  name?: string;
  isMe: boolean;
}

export type PropsData = {
  canProcessNow: boolean;
  contact: ContactType;
};

type PropsHousekeeping = {
  i18n: LocalizerType;
};

export type PropsActions = {
  downloadNewVersion: () => unknown;
};

type Props = PropsData & PropsHousekeeping & PropsActions;

export class UnsupportedMessage extends React.Component<Props> {
  public render() {
    const { canProcessNow, contact, i18n, downloadNewVersion } = this.props;
    const { isMe } = contact;

    const otherStringId = canProcessNow
      ? 'Message--unsupported-message-ask-to-resend'
      : 'Message--unsupported-message';
    const meStringId = canProcessNow
      ? 'Message--from-me-unsupported-message-ask-to-resend'
      : 'Message--from-me-unsupported-message';
    const stringId = isMe ? meStringId : otherStringId;

    return (
      <div className="module-unsupported-message">
        <div
          className={classNames(
            'module-unsupported-message__icon',
            canProcessNow
              ? 'module-unsupported-message__icon--can-process'
              : null
          )}
        />
        <div className="module-unsupported-message__text">
          <Intl
            id={stringId}
            components={[
              <span
                key="external-1"
                className="module-unsupported-message__contact"
              >
                <ContactName
                  name={contact.name}
                  profileName={contact.profileName}
                  phoneNumber={contact.phoneNumber}
                  module="module-unsupported-message__contact"
                />
              </span>,
            ]}
            i18n={i18n}
          />
        </div>
        {canProcessNow ? null : (
          <div
            role="button"
            onClick={() => {
              downloadNewVersion();
            }}
            className="module-unsupported-message__button"
          >
            {i18n('Message--update-signal')}
          </div>
        )}
      </div>
    );
  }
}
