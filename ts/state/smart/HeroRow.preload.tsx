// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { PanelType } from '../../types/Panels.std.ts';
import { ConversationHero } from '../../components/conversation/ConversationHero.dom.tsx';
import { getPreferredBadgeSelector } from '../selectors/badges.preload.ts';
import { getIntl, getTheme } from '../selectors/user.std.ts';
import { getHasStoriesSelector } from '../selectors/stories2.dom.ts';
import { isSignalConversation } from '../../util/isSignalConversation.dom.ts';
import {
  getConversationByServiceIdSelector,
  getConversationSelector,
  getPendingAvatarDownloadSelector,
} from '../selectors/conversations.dom.ts';
import { useSharedGroupNamesOnMount } from '../../util/sharedGroupNames.dom.ts';
import {
  type ConversationType,
  useConversationsActions,
} from '../ducks/conversations.preload.ts';
import { useGlobalModalActions } from '../ducks/globalModals.preload.ts';
import { useStoriesActions } from '../ducks/stories.preload.ts';
import { getAddedByForGroup } from '../../util/getAddedByForGroup.preload.ts';
import { getGroupMemberships } from '../../util/getGroupMemberships.dom.ts';
import { useNavActions } from '../ducks/nav.std.ts';
import { tw } from '../../axo/tw.dom.tsx';
import { isInSystemContacts } from '../../util/isInSystemContacts.std.ts';

type SmartHeroRowProps = Readonly<{
  id: string;
}>;

function isFromOrAddedByTrustedContact(
  conversation: ConversationType
): boolean {
  if (conversation.type === 'direct') {
    return Boolean(conversation.name) || Boolean(conversation.profileSharing);
  }

  const addedByConv = getAddedByForGroup(conversation);
  if (!addedByConv) {
    return false;
  }

  return Boolean(
    addedByConv.isMe || addedByConv.name || addedByConv.profileSharing
  );
}

export const SmartHeroRow = memo(function SmartHeroRow({
  id,
}: SmartHeroRowProps) {
  const i18n = useSelector(getIntl);
  const theme = useSelector(getTheme);
  const getPreferredBadge = useSelector(getPreferredBadgeSelector);
  const hasStoriesSelector = useSelector(getHasStoriesSelector);
  const conversationSelector = useSelector(getConversationSelector);
  const conversationByServiceIdSelector = useSelector(
    getConversationByServiceIdSelector
  );
  const isPendingAvatarDownload = useSelector(getPendingAvatarDownloadSelector);
  const sharedGroupNames = useSharedGroupNamesOnMount(id);
  const conversation = conversationSelector(id);
  if (conversation == null) {
    throw new Error(`Did not find conversation ${id} in state!`);
  }
  const groupMemberships = getGroupMemberships(
    conversation,
    conversationByServiceIdSelector
  );
  const { memberships, pendingMemberships, pendingApprovalMemberships } =
    groupMemberships;
  const badge = getPreferredBadge(conversation.badges);
  const hasStories = hasStoriesSelector(id);
  const isSignalConversationValue = isSignalConversation(conversation);
  const fromOrAddedByTrustedContact =
    isFromOrAddedByTrustedContact(conversation);
  const { startAvatarDownload } = useConversationsActions();
  const { pushPanelForConversation } = useNavActions();
  const { toggleAboutContactModal, toggleProfileNameWarningModal } =
    useGlobalModalActions();
  const openConversationDetails = useCallback(() => {
    pushPanelForConversation({ type: PanelType.ConversationDetails });
  }, [pushPanelForConversation]);
  const { viewUserStories } = useStoriesActions();
  const {
    avatarPlaceholderGradient,
    acceptedMessageRequest,
    avatarUrl,
    color,
    groupDescription,
    hasAvatar,
    isMe,
    membersCount,
    nicknameGivenName,
    nicknameFamilyName,
    profileName,
    title,
    type,
  } = conversation;
  const invitesCount =
    pendingMemberships.length + pendingApprovalMemberships.length;
  return (
    <div className={tw('mt-10 flex justify-center')}>
      <ConversationHero
        avatarPlaceholderGradient={avatarPlaceholderGradient}
        acceptedMessageRequest={acceptedMessageRequest}
        avatarUrl={avatarUrl}
        badge={badge}
        color={color}
        conversationType={type}
        fromOrAddedByTrustedContact={fromOrAddedByTrustedContact}
        groupDescription={groupDescription}
        hasAvatar={hasAvatar}
        hasNickname={Boolean(nicknameGivenName || nicknameFamilyName)}
        hasProfileName={Boolean(profileName)}
        hasStories={hasStories}
        i18n={i18n}
        id={id}
        isMe={isMe}
        invitesCount={invitesCount}
        isInSystemContacts={isInSystemContacts(conversation)}
        isSignalConversation={isSignalConversationValue}
        membersCount={membersCount}
        memberships={memberships}
        openConversationDetails={openConversationDetails}
        pendingAvatarDownload={isPendingAvatarDownload(id)}
        profileName={profileName}
        sharedGroupNames={sharedGroupNames}
        startAvatarDownload={() => startAvatarDownload(id)}
        theme={theme}
        title={title}
        toggleAboutContactModal={toggleAboutContactModal}
        toggleProfileNameWarningModal={toggleProfileNameWarningModal}
        viewUserStories={viewUserStories}
      />
    </div>
  );
});
