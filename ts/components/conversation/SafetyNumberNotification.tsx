// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { Button, ButtonSize, ButtonVariant } from '../Button';
import { SystemMessage } from './SystemMessage';
import { ContactName } from './ContactName';
import { Intl } from '../Intl';
import type { LocalizerType } from '../../types/Util';

export type ContactType = {
  id: string;
  title: string;
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
    <SystemMessage
      icon="safety-number"
      contents={
        <Intl
          id={changeKey}
          components={[
            <span
              key="external-1"
              className="module-safety-number-notification__contact"
            >
              <ContactName
                title={contact.title}
                module="module-safety-number-notification__contact"
              />
            </span>,
          ]}
          i18n={i18n}
        />
      }
      button={
        <Button
          onClick={() => {
            showIdentity(contact.id);
          }}
          size={ButtonSize.Small}
          variant={ButtonVariant.SystemMessage}
        >
          {i18n('verifyNewNumber')}
        </Button>
      }
    />
  );
};
