// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { useSelector } from 'react-redux';
import type { StateType } from '../reducer';

import { ContactName } from '../../components/conversation/ContactName';

import { getIntl } from '../selectors/user';
import type { GetConversationByIdType } from '../selectors/conversations';
import { getConversationSelector } from '../selectors/conversations';

import type { LocalizerType } from '../../types/Util';

type ExternalProps = {
  conversationId: string;
};

export const SmartContactName: React.ComponentType<ExternalProps> = props => {
  const { conversationId } = props;
  const i18n = useSelector<StateType, LocalizerType>(getIntl);
  const getConversation = useSelector<StateType, GetConversationByIdType>(
    getConversationSelector
  );

  const conversation = getConversation(conversationId) || {
    title: i18n('unknownContact'),
  };

  return (
    <ContactName
      firstName={conversation.firstName}
      title={conversation.title}
    />
  );
};
