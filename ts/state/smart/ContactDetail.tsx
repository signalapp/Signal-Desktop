// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useEffect } from 'react';
import { useSelector } from 'react-redux';

import type { Props as ContactDetailProps } from '../../components/conversation/ContactDetail.js';
import { ContactDetail } from '../../components/conversation/ContactDetail.js';
import { useConversationsActions } from '../ducks/conversations.js';
import { getMessages } from '../selectors/conversations.js';
import { getIntl, getRegionCode } from '../selectors/user.js';
import { embeddedContactSelector } from '../../types/EmbeddedContact.js';
import { getAccountSelector } from '../selectors/accounts.js';

export type OwnProps = Pick<ContactDetailProps, 'messageId'>;

export const SmartContactDetail = memo(function SmartContactDetail({
  messageId,
}: OwnProps): JSX.Element | null {
  const i18n = useSelector(getIntl);
  const regionCode = useSelector(getRegionCode);
  const messageLookup = useSelector(getMessages);
  const accountSelector = useSelector(getAccountSelector);
  const {
    cancelAttachmentDownload,
    kickOffAttachmentDownload,
    popPanelForConversation,
    startConversation,
  } = useConversationsActions();

  const contact = messageLookup[messageId]?.contact?.[0];

  useEffect(() => {
    if (!contact) {
      popPanelForConversation();
    }
  }, [contact, popPanelForConversation]);

  if (!contact) {
    return null;
  }

  const numbers = contact?.number;
  const firstNumber = numbers && numbers[0] ? numbers[0].value : undefined;
  const fixedContact = embeddedContactSelector(contact, {
    firstNumber,
    regionCode,
    serviceId: accountSelector(firstNumber),
  });
  const signalAccount =
    contact.firstNumber && contact.serviceId
      ? {
          phoneNumber: contact.firstNumber,
          serviceId: contact.serviceId,
        }
      : undefined;

  return (
    <ContactDetail
      cancelAttachmentDownload={cancelAttachmentDownload}
      contact={fixedContact}
      hasSignalAccount={Boolean(signalAccount)}
      i18n={i18n}
      kickOffAttachmentDownload={kickOffAttachmentDownload}
      messageId={messageId}
      onSendMessage={() => {
        if (signalAccount) {
          startConversation(signalAccount.phoneNumber, signalAccount.serviceId);
        }
      }}
    />
  );
});
