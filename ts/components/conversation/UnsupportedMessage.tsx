// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { SystemMessage } from './SystemMessage';
import { Button, ButtonSize, ButtonVariant } from '../Button';
import { ContactName } from './ContactName';
import { Intl } from '../Intl';
import type { LocalizerType } from '../../types/Util';
import { openLinkInWebBrowser } from '../../util/openLinkInWebBrowser';

export type ContactType = {
  id: string;
  phoneNumber?: string;
  profileName?: string;
  title: string;
  name?: string;
  isMe: boolean;
};

export type PropsData = {
  canProcessNow: boolean;
  contact: ContactType;
};

type PropsHousekeeping = {
  i18n: LocalizerType;
};

export type Props = PropsData & PropsHousekeeping;

export function UnsupportedMessage({
  canProcessNow,
  contact,
  i18n,
}: Props): JSX.Element {
  const { isMe } = contact;

  const otherStringId = canProcessNow
    ? 'Message--unsupported-message-ask-to-resend'
    : 'Message--unsupported-message';
  const meStringId = canProcessNow
    ? 'Message--from-me-unsupported-message-ask-to-resend'
    : 'Message--from-me-unsupported-message';
  const stringId = isMe ? meStringId : otherStringId;
  const icon = canProcessNow ? 'unsupported--can-process' : 'unsupported';

  return (
    <SystemMessage
      icon={icon}
      contents={
        // eslint-disable-next-line local-rules/valid-i18n-keys
        <Intl
          id={stringId}
          components={[
            <span
              key="external-1"
              className="module-unsupported-message__contact"
            >
              <ContactName
                title={contact.title}
                module="module-unsupported-message__contact"
              />
            </span>,
          ]}
          i18n={i18n}
        />
      }
      button={
        canProcessNow ? undefined : (
          <div className="SystemMessage__line">
            <Button
              onClick={() => {
                openLinkInWebBrowser('https://signal.org/download');
              }}
              size={ButtonSize.Small}
              variant={ButtonVariant.SystemMessage}
            >
              {i18n('Message--update-signal')}
            </Button>
          </div>
        )
      }
    />
  );
}
