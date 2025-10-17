// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { ContactName } from '../../components/conversation/ContactName.dom.js';
import { getIntl } from '../selectors/user.std.js';
import {
  getConversationSelector,
  getSelectedConversationId,
} from '../selectors/conversations.dom.js';
import { useGlobalModalActions } from '../ducks/globalModals.preload.js';

type ExternalProps = {
  contactId: string;
};

export const SmartContactName = memo(function SmartContactName({
  contactId,
}: ExternalProps) {
  const i18n = useSelector(getIntl);
  const getConversation = useSelector(getConversationSelector);
  const currentConversationId = useSelector(getSelectedConversationId);

  const { showContactModal } = useGlobalModalActions();

  const contact = useMemo(() => {
    return getConversation(contactId);
  }, [getConversation, contactId]);

  const handleClick = useCallback(() => {
    showContactModal(contactId, currentConversationId);
  }, [showContactModal, contactId, currentConversationId]);

  return (
    <ContactName
      firstName={contact.firstName}
      title={contact.title ?? i18n('icu:unknownContact')}
      onClick={handleClick}
    />
  );
});
