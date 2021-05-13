// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import {
  GroupV2PendingMembership,
  GroupV2RequestingMembership,
  PendingInvites,
  PropsType,
} from '../../components/conversation/conversation-details/PendingInvites';
import { StateType } from '../reducer';

import { getIntl } from '../selectors/user';
import { getConversationByIdSelector } from '../selectors/conversations';
import { isConversationUnregistered } from '../../util/isConversationUnregistered';
import { assert } from '../../util/assert';

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
  const conversationSelector = getConversationByIdSelector(state);

  const conversation = conversationSelector(props.conversationId);
  assert(
    conversation,
    '<SmartPendingInvites> expected a conversation to be found'
  );

  const pendingApprovalMemberships = (
    conversation.pendingApprovalMemberships || []
  ).reduce((result: Array<GroupV2RequestingMembership>, membership) => {
    const member = conversationSelector(membership.conversationId);
    if (!member || isConversationUnregistered(member)) {
      return result;
    }
    return [...result, { member }];
  }, []);

  const pendingMemberships = (conversation.pendingMemberships || []).reduce(
    (result: Array<GroupV2PendingMembership>, membership) => {
      const member = conversationSelector(membership.conversationId);
      if (!member || isConversationUnregistered(member)) {
        return result;
      }
      return [
        ...result,
        {
          member,
          metadata: { addedByUserId: membership.addedByUserId },
        },
      ];
    },
    []
  );

  return {
    ...props,
    conversation,
    i18n: getIntl(state),
    pendingApprovalMemberships,
    pendingMemberships,
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartPendingInvites = smart(PendingInvites);
