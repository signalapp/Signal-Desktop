// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { SystemMessage } from './SystemMessage';
import { ContactName } from './ContactName';
import { I18n } from '../I18n';
import type { LocalizerType } from '../../types/Util';

import { missingCaseError } from '../../util/missingCaseError';

type Contact = { title: string };

export type PropsData = {
  type: 'markVerified' | 'markNotVerified';
  isLocal: boolean;
  contact: Contact;
};

type PropsHousekeeping = {
  i18n: LocalizerType;
};

export type Props = PropsData & PropsHousekeeping;

function VerificationNotificationContents({
  contact,
  isLocal,
  type,
  i18n,
}: Props) {
  const name = (
    <ContactName
      key="external-1"
      title={contact.title}
      module="module-verification-notification__contact"
    />
  );

  switch (type) {
    case 'markVerified':
      return isLocal ? (
        <I18n id="icu:youMarkedAsVerified" components={{ name }} i18n={i18n} />
      ) : (
        <I18n
          id="icu:youMarkedAsVerifiedOtherDevice"
          components={{ name }}
          i18n={i18n}
        />
      );
    case 'markNotVerified':
      return isLocal ? (
        <I18n
          id="icu:youMarkedAsNotVerified"
          components={{ name }}
          i18n={i18n}
        />
      ) : (
        <I18n
          id="icu:youMarkedAsNotVerifiedOtherDevice"
          components={{ name }}
          i18n={i18n}
        />
      );
    default:
      throw missingCaseError(type);
  }
}

export function VerificationNotification(props: Props): JSX.Element {
  const { type } = props;
  return (
    <SystemMessage
      icon={type === 'markVerified' ? 'verified' : 'verified-not'}
      contents={<VerificationNotificationContents {...props} />}
    />
  );
}
