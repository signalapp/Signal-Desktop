// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import type { PropsDataType } from '../../components/conversation/conversation-details/PendingInvites';
import { PendingInvites } from '../../components/conversation/conversation-details/PendingInvites';
import type { StateType } from '../reducer';

import { getIntl, getTheme } from '../selectors/user';
import { getPreferredBadgeSelector } from '../selectors/badges';
import {
  getConversationByIdSelector,
  getConversationByServiceIdSelector,
} from '../selectors/conversations';
import { getGroupMemberships } from '../../util/getGroupMemberships';
import { assertDev } from '../../util/assert';
import type { AciString } from '../../types/ServiceId';

export type SmartPendingInvitesProps = {
  conversationId: string;
  ourAci: AciString;
};

const mapStateToProps = (
  state: StateType,
  props: SmartPendingInvitesProps
): PropsDataType => {
  const conversationSelector = getConversationByIdSelector(state);
  const conversationByServiceIdSelector =
    getConversationByServiceIdSelector(state);

  const conversation = conversationSelector(props.conversationId);
  assertDev(
    conversation,
    '<SmartPendingInvites> expected a conversation to be found'
  );

  return {
    ...props,
    ...getGroupMemberships(conversation, conversationByServiceIdSelector),
    conversation,
    getPreferredBadge: getPreferredBadgeSelector(state),
    i18n: getIntl(state),
    theme: getTheme(state),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartPendingInvites = smart(PendingInvites);
