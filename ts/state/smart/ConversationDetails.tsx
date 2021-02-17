// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';

import { StateType } from '../reducer';
import {
  ConversationDetails,
  StateProps,
} from '../../components/conversation/conversation-details/ConversationDetails';
import { getConversationSelector } from '../selectors/conversations';
import { getIntl } from '../selectors/user';
import { MediaItemType } from '../../components/LightboxGallery';

export type SmartConversationDetailsProps = {
  conversationId: string;
  hasGroupLink: boolean;
  loadRecentMediaItems: (limit: number) => void;
  setDisappearingMessages: (seconds: number) => void;
  showAllMedia: () => void;
  showContactModal: (conversationId: string) => void;
  showGroupLinkManagement: () => void;
  showGroupV2Permissions: () => void;
  showPendingInvites: () => void;
  showLightboxForMedia: (
    selectedMediaItem: MediaItemType,
    media: Array<MediaItemType>
  ) => void;
  onBlockAndDelete: () => void;
  onDelete: () => void;
};

const mapStateToProps = (
  state: StateType,
  props: SmartConversationDetailsProps
): StateProps => {
  const conversation = getConversationSelector(state)(props.conversationId);
  const canEditGroupInfo =
    conversation && conversation.canEditGroupInfo
      ? conversation.canEditGroupInfo
      : false;
  const isAdmin =
    conversation && conversation.areWeAdmin ? conversation.areWeAdmin : false;

  return {
    ...props,
    canEditGroupInfo,
    conversation,
    i18n: getIntl(state),
    isAdmin,
  };
};

const smart = connect(mapStateToProps);

export const SmartConversationDetails = smart(ConversationDetails);
