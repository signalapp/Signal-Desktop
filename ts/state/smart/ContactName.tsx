// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { useSelector } from 'react-redux';
import type { StateType } from '../reducer';

import { ContactName } from '../../components/conversation/ContactName';

import { getIntl } from '../selectors/user';
import type { GetConversationByIdType } from '../selectors/conversations';
import {
  getConversationSelector,
  getSelectedConversationId,
} from '../selectors/conversations';

import type { LocalizerType } from '../../types/Util';
import { useGlobalModalActions } from '../ducks/globalModals';

type ExternalProps = {
  contactId: string;
};

export function SmartContactName(props: ExternalProps): JSX.Element {
  const { contactId } = props;
  const i18n = useSelector<StateType, LocalizerType>(getIntl);
  const getConversation = useSelector<StateType, GetConversationByIdType>(
    getConversationSelector
  );

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
}
