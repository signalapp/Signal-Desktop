// Copyright 2018-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { Button, ButtonSize, ButtonVariant } from '../Button';
import { ContactName } from './ContactName';
import { Intl } from '../Intl';
import { LocalizerType } from '../../types/Util';

export type ContactType = {
  id: string;
  phoneNumber?: string;
  profileName?: string;
  title: string;
  name?: string;
};

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

export type Props = PropsData & PropsHousekeeping & PropsActions;

export const SafetyNumberNotification = ({
  contact,
  isGroup,
  i18n,
  showIdentity,
}: Props): JSX.Element => {
  const changeKey = isGroup
    ? 'safetyNumberChangedGroup'
    : 'safetyNumberChanged';

  return (
    <div className="SystemMessage SystemMessage--multiline">
      <div className="SystemMessage__line">
        <div className="SystemMessage__icon SystemMessage__icon--safety-number" />
        <span>
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
                  title={contact.title}
                  module="module-safety-number-notification__contact"
                  i18n={i18n}
                />
              </span>,
            ]}
            i18n={i18n}
          />
        </span>
      </div>
      <div className="SystemMessage__line">
        <Button
          onClick={() => {
            showIdentity(contact.id);
          }}
          size={ButtonSize.Small}
          variant={ButtonVariant.SystemMessage}
        >
          {i18n('verifyNewNumber')}
        </Button>
      </div>
    </div>
  );
};
