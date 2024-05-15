// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { SystemMessage } from './SystemMessage';
import { Button, ButtonSize, ButtonVariant } from '../Button';
import { ContactName } from './ContactName';
import { I18n } from '../I18n';
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

function UnsupportedMessageContents({ canProcessNow, contact, i18n }: Props) {
  const { isMe } = contact;
  const contactName = (
    <span key="external-1" className="module-unsupported-message__contact">
      <ContactName
        title={contact.title}
        module="module-unsupported-message__contact"
      />
    </span>
  );
  if (isMe) {
    if (canProcessNow) {
      return (
        <I18n
          id="icu:Message--unsupported-message-ask-to-resend"
          components={{ contact: contactName }}
          i18n={i18n}
        />
      );
    }
    return <I18n id="icu:Message--from-me-unsupported-message" i18n={i18n} />;
  }
  if (canProcessNow) {
    return (
      <I18n
        id="icu:Message--from-me-unsupported-message-ask-to-resend"
        i18n={i18n}
      />
    );
  }
  return (
    <I18n
      id="icu:Message--unsupported-message"
      i18n={i18n}
      components={{
        contact: contactName,
      }}
    />
  );
}

export function UnsupportedMessage({
  canProcessNow,
  contact,
  i18n,
}: Props): JSX.Element {
  return (
    <SystemMessage
      icon={canProcessNow ? 'unsupported--can-process' : 'unsupported'}
      contents={
        <UnsupportedMessageContents
          canProcessNow={canProcessNow}
          contact={contact}
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
              {i18n('icu:Message--update-signal')}
            </Button>
          </div>
        )
      }
    />
  );
}
