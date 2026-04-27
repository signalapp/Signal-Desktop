// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { Button, ButtonSize, ButtonVariant } from '../Button.dom.tsx';
import { SystemMessage } from './SystemMessage.dom.tsx';
import { ContactName } from './ContactName.dom.tsx';
import { I18n } from '../I18n.dom.tsx';
import type { LocalizerType } from '../../types/Util.std.ts';

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
}: Props): React.JSX.Element {
  const name = (
    <span
      key="external-1"
      className="module-safety-number-notification__contact"
    >
      <ContactName
        title={contact.title}
        module="module-safety-number-notification__contact"
      />
    </span>
  );
  return (
    <SystemMessage
      icon="safety-number"
      contents={
        isGroup ? (
          <I18n
            id="icu:safetyNumberChangedGroup"
            components={{ name }}
            i18n={i18n}
          />
        ) : (
          <I18n id="icu:safetyNumberChanged" i18n={i18n} />
        )
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
