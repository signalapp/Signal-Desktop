// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { connect } from 'react-redux';
import { sortBy } from 'lodash';

import type { StateType } from '../reducer';
import { mapDispatchToProps } from '../actions';
import type { StateProps } from '../../components/conversation/conversation-details/ConversationDetails';
import { ConversationDetails } from '../../components/conversation/conversation-details/ConversationDetails';
import {
  getConversationByIdSelector,
  getConversationByServiceIdSelector,
  getAllComposableConversations,
} from '../selectors/conversations';
import { getGroupMemberships } from '../../util/getGroupMemberships';
import { getActiveCallState } from '../selectors/calling';
import {
  getAreWeASubscriber,
  getDefaultConversationColor,
} from '../selectors/items';
import { getIntl, getTheme } from '../selectors/user';
import {
  getBadgesSelector,
  getPreferredBadgeSelector,
} from '../selectors/badges';
import { assertDev } from '../../util/assert';
import { SignalService as Proto } from '../../protobuf';
import { getConversationColorAttributes } from '../../util/getConversationColorAttributes';
import type { SmartChooseGroupMembersModalPropsType } from './ChooseGroupMembersModal';
import { SmartChooseGroupMembersModal } from './ChooseGroupMembersModal';
import type { SmartConfirmAdditionsModalPropsType } from './ConfirmAdditionsModal';
import { SmartConfirmAdditionsModal } from './ConfirmAdditionsModal';
import {
  getGroupSizeRecommendedLimit,
  getGroupSizeHardLimit,
} from '../../groups/limits';
import type { CallHistoryGroup } from '../../types/CallDisposition';
import { getSelectedNavTab } from '../selectors/nav';

export type SmartConversationDetailsProps = {
  conversationId: string;
  callHistoryGroup?: CallHistoryGroup | null;
};

const ACCESS_ENUM = Proto.AccessControl.AccessRequired;

const renderChooseGroupMembersModal = (
  props: SmartChooseGroupMembersModalPropsType
) => {
  return <SmartChooseGroupMembersModal {...props} />;
};

const renderConfirmAdditionsModal = (
  props: SmartConfirmAdditionsModalPropsType
) => {
  return <SmartConfirmAdditionsModal {...props} />;
};

const mapStateToProps = (
  state: StateType,
  props: SmartConversationDetailsProps
): StateProps => {
  const conversationSelector = getConversationByIdSelector(state);
  const conversation = conversationSelector(props.conversationId);
  assertDev(
    conversation,
    '<SmartConversationDetails> expected a conversation to be found'
  );

  const canEditGroupInfo = Boolean(conversation.canEditGroupInfo);
  const canAddNewMembers = Boolean(conversation.canAddNewMembers);
  const isAdmin = Boolean(conversation.areWeAdmin);

  const hasGroupLink =
    Boolean(conversation.groupLink) &&
    conversation.accessControlAddFromInviteLink !== ACCESS_ENUM.UNSATISFIABLE;

  const conversationByServiceIdSelector =
    getConversationByServiceIdSelector(state);
  const groupMemberships = getGroupMemberships(
    conversation,
    conversationByServiceIdSelector
  );

  const badges = getBadgesSelector(state)(conversation.badges);
  const defaultConversationColor = getDefaultConversationColor(state);

  const groupsInCommon =
    conversation.type === 'direct'
      ? getAllComposableConversations(state).filter(
          c =>
            c.type === 'group' &&
            (c.memberships ?? []).some(
              member => member.aci === conversation.serviceId
            )
        )
      : [];

  const groupsInCommonSorted = sortBy(groupsInCommon, 'title');

  const maxGroupSize = getGroupSizeHardLimit(1001);
  const maxRecommendedGroupSize = getGroupSizeRecommendedLimit(151);
  return {
    ...props,

    areWeASubscriber: getAreWeASubscriber(state),
    badges,
    canEditGroupInfo,
    canAddNewMembers,
    conversation: {
      ...conversation,
      ...getConversationColorAttributes(conversation, defaultConversationColor),
    },
    getPreferredBadge: getPreferredBadgeSelector(state),
    hasActiveCall: Boolean(getActiveCallState(state)),
    i18n: getIntl(state),
    isAdmin,
    ...groupMemberships,
    maxGroupSize,
    maxRecommendedGroupSize,
    userAvatarData: conversation.avatars || [],
    hasGroupLink,
    groupsInCommon: groupsInCommonSorted,
    isGroup: conversation.type === 'group',
    selectedNavTab: getSelectedNavTab(state),
    theme: getTheme(state),
    renderChooseGroupMembersModal,
    renderConfirmAdditionsModal,
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartConversationDetails = smart(ConversationDetails);
