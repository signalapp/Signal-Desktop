// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { SystemMessage } from './SystemMessage';
import { ContactName } from './ContactName';
import { Intl } from '../Intl';
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
            title={contact.title}
            module="module-verification-notification__contact"
          />,
        ]}
        i18n={i18n}
      />
    );
  }

  public override render(): JSX.Element {
    const { type } = this.props;
    const icon = type === 'markVerified' ? 'verified' : 'verified-not';

    return <SystemMessage icon={icon} contents={this.renderContents()} />;
  }
}
