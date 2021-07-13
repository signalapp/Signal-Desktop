// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';

import { StateType } from '../reducer';
import {
  ConversationDetails,
  StateProps,
} from '../../components/conversation/conversation-details/ConversationDetails';
import {
  getCandidateContactsForNewGroup,
  getConversationByIdSelector,
} from '../selectors/conversations';
import { getGroupMemberships } from '../../util/getGroupMemberships';
import { getIntl } from '../selectors/user';
import { MediaItemType } from '../../components/LightboxGallery';
import { assert } from '../../util/assert';

export type SmartConversationDetailsProps = {
  addMembers: (conversationIds: ReadonlyArray<string>) => Promise<void>;
  conversationId: string;
  hasGroupLink: boolean;
  loadRecentMediaItems: (limit: number) => void;
  setDisappearingMessages: (seconds: number) => void;
  showAllMedia: () => void;
  showContactModal: (conversationId: string) => void;
  showGroupChatColorEditor: () => void;
  showGroupLinkManagement: () => void;
  showGroupV2Permissions: () => void;
  showPendingInvites: () => void;
  showLightboxForMedia: (
    selectedMediaItem: MediaItemType,
    media: Array<MediaItemType>
  ) => void;
  updateGroupAttributes: (
    _: Readonly<{
      avatar?: undefined | ArrayBuffer;
      title?: string;
    }>
  ) => Promise<void>;
  onBlock: () => void;
  onLeave: () => void;
};

const mapStateToProps = (
  state: StateType,
  props: SmartConversationDetailsProps
): StateProps => {
  const conversationSelector = getConversationByIdSelector(state);
  const conversation = conversationSelector(props.conversationId);
  assert(
    conversation,
    '<SmartConversationDetails> expected a conversation to be found'
  );

  const canEditGroupInfo =
    conversation && conversation.canEditGroupInfo
      ? conversation.canEditGroupInfo
      : false;

  const isAdmin = Boolean(conversation?.areWeAdmin);
  const candidateContactsToAdd = getCandidateContactsForNewGroup(state);

  return {
    ...props,
    canEditGroupInfo,
    candidateContactsToAdd,
    conversation,
    i18n: getIntl(state),
    isAdmin,
    ...getGroupMemberships(conversation, conversationSelector),
  };
};

const smart = connect(mapStateToProps);

export const SmartConversationDetails = smart(ConversationDetails);
