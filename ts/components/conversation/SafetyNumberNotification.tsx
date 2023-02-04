// Copyright 2018 Signal Messenger, LLC
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
  toggleSafetyNumberModal: (id: string) => void;
};

export type Props = PropsData & PropsHousekeeping & PropsActions;

export function SafetyNumberNotification({
  contact,
  isGroup,
  i18n,
  toggleSafetyNumberModal,
}: Props): JSX.Element {
  const changeKey = isGroup
    ? 'safetyNumberChangedGroup'
    : 'safetyNumberChanged';

  return (
    <SystemMessage
      icon="safety-number"
      contents={
        // eslint-disable-next-line local-rules/valid-i18n-keys
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
            toggleSafetyNumberModal(contact.id);
          }}
          size={ButtonSize.Small}
          variant={ButtonVariant.SystemMessage}
        >
          {i18n('icu:SafetyNumberNotification__viewSafetyNumber')}
        </Button>
      }
    />
  );
}
