// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';

import type { PropsDataType } from '../../components/conversation/conversation-details/GroupLinkManagement';
import type { StateType } from '../reducer';
import { GroupLinkManagement } from '../../components/conversation/conversation-details/GroupLinkManagement';
import { getConversationSelector } from '../selectors/conversations';
import { getIntl } from '../selectors/user';
import { mapDispatchToProps } from '../actions';

export type SmartGroupLinkManagementProps = {
  conversationId: string;
};

const mapStateToProps = (
  state: StateType,
  props: SmartGroupLinkManagementProps
): PropsDataType => {
  const conversation = getConversationSelector(state)(props.conversationId);
  const isAdmin = Boolean(conversation?.areWeAdmin);

  return {
    ...props,
    conversation,
    i18n: getIntl(state),
    isAdmin,
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartGroupLinkManagement = smart(GroupLinkManagement);
