// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import { ContactName } from '../../components/conversation/ContactName';
import { getIntl } from '../selectors/user';
import {
  getConversationSelector,
  getSelectedConversationId,
} from '../selectors/conversations';
import { useGlobalModalActions } from '../ducks/globalModals';

type ExternalProps = {
  contactId: string;
};

export const SmartContactName = memo(function SmartContactName(
  props: ExternalProps
) {
  const { contactId } = props;
  const i18n = useSelector(getIntl);
  const getConversation = useSelector(getConversationSelector);

  const contact = getConversation(contactId) || {
    title: i18n('icu:unknownContact'),
  };
  const currentConversationId = useSelector(getSelectedConversationId);
  const currentConversation = getConversation(currentConversationId);

  const { showContactModal } = useGlobalModalActions();

  return (
    <ContactName
      firstName={contact.firstName}
      title={contact.title}
      onClick={() => showContactModal(contact.id, currentConversation.id)}
    />
  );
});
