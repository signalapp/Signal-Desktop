// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';

import type { Props as ContactDetailProps } from '../../components/conversation/ContactDetail.dom.tsx';
import { ContactDetail } from '../../components/conversation/ContactDetail.dom.tsx';
import { useAccountsActions } from '../ducks/accounts.preload.ts';
import { useConversationsActions } from '../ducks/conversations.preload.ts';
import { getMessages } from '../selectors/conversations.dom.ts';
import { getIntl, getRegionCode } from '../selectors/user.std.ts';
import { embeddedContactSelector } from '../../types/EmbeddedContact.std.ts';
import { startConversation } from '../../util/startConversation.dom.ts';
import type {
  EmbeddedContactType,
  EmbeddedContactForUIType,
} from '../../types/EmbeddedContact.std.ts';
import { getAccountSelector } from '../selectors/accounts.std.ts';
import { useNavActions } from '../ducks/nav.std.ts';

export type OwnProps = Pick<ContactDetailProps, 'messageId'>;

export function useLookupContact(
  contact: EmbeddedContactType
): EmbeddedContactForUIType;
export function useLookupContact(
  contact: EmbeddedContactType | undefined
): EmbeddedContactForUIType | undefined;

export function useLookupContact(
  contact: EmbeddedContactType | undefined
): EmbeddedContactForUIType | undefined {
  const regionCode = useSelector(getRegionCode);
  const accountSelector = useSelector(getAccountSelector);
  const { checkForAccount } = useAccountsActions();

  const numbers = contact?.number;
  const firstNumber = numbers && numbers[0] ? numbers[0].value : undefined;
  const serviceId = accountSelector(firstNumber);

  useEffect(() => {
    if (firstNumber == null) {
      return;
    }
    if (serviceId != null) {
      return;
    }

    checkForAccount(firstNumber);
  }, [firstNumber, serviceId, checkForAccount]);

  return useMemo(() => {
    if (contact == null) {
      return undefined;
    }

    return embeddedContactSelector(contact, {
      firstNumber,
      regionCode,
      serviceId,
    });
  }, [contact, firstNumber, regionCode, serviceId]);
}

export const SmartContactDetail = memo(function SmartContactDetail({
  messageId,
}: OwnProps): React.JSX.Element | null {
  const i18n = useSelector(getIntl);
  const messageLookup = useSelector(getMessages);
  const { cancelAttachmentDownload, kickOffAttachmentDownload } =
    useConversationsActions();
  const { popPanelForConversation } = useNavActions();

  const contact = useLookupContact(messageLookup[messageId]?.contact?.[0]);

  useEffect(() => {
    if (!contact) {
      popPanelForConversation();
    }
  }, [contact, popPanelForConversation]);

  if (!contact) {
    return null;
  }

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
      contact={contact}
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
