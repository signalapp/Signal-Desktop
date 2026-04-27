// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { ContactName } from '../../components/conversation/ContactName.dom.tsx';
import { getIntl } from '../selectors/user.std.ts';
import { getConversationSelector } from '../selectors/conversations.dom.ts';
import { getSelectedConversationId } from '../selectors/nav.std.ts';
import { useGlobalModalActions } from '../ducks/globalModals.preload.ts';

type ExternalProps = {
  contactId: string;
};

export const SmartContactName = memo(function SmartContactName({
  contactId,
}: ExternalProps) {
  const i18n = useSelector(getIntl);
  const getConversation = useSelector(getConversationSelector);
  const conversationId = useSelector(getSelectedConversationId);

  const { showContactModal } = useGlobalModalActions();

  const contact = useMemo(() => {
    return getConversation(contactId);
  }, [getConversation, contactId]);

  const handleClick = useCallback(() => {
    showContactModal({ contactId, conversationId });
  }, [showContactModal, contactId, conversationId]);

  return (
    <ContactName
      firstName={contact.firstName}
      title={contact.title ?? i18n('icu:unknownContact')}
      onClick={handleClick}
    />
  );
});
