// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import {
  PendingInvites,
  PropsType,
} from '../../components/conversation/conversation-details/PendingInvites';
import { StateType } from '../reducer';

import { getIntl } from '../selectors/user';
import { getConversationSelector } from '../selectors/conversations';

export type SmartPendingInvitesProps = {
  conversationId: string;
  ourConversationId?: string;
  readonly approvePendingMembership: (conversationid: string) => void;
  readonly revokePendingMemberships: (membershipIds: Array<string>) => void;
};

const mapStateToProps = (
  state: StateType,
  props: SmartPendingInvitesProps
): PropsType => {
  const { conversationId } = props;

  const conversation = getConversationSelector(state)(conversationId);

  return {
    ...props,
    conversation,
    i18n: getIntl(state),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartPendingInvites = smart(PendingInvites);
