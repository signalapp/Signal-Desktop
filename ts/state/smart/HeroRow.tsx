// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import { ConversationHero } from '../../components/conversation/ConversationHero';
import { getPreferredBadgeSelector } from '../selectors/badges';
import { getIntl, getTheme } from '../selectors/user';
import { getHasStoriesSelector } from '../selectors/stories2';
import { isSignalConversation } from '../../util/isSignalConversation';
import { getConversationSelector } from '../selectors/conversations';
import { useConversationsActions } from '../ducks/conversations';
import { useGlobalModalActions } from '../ducks/globalModals';
import { useStoriesActions } from '../ducks/stories';

type SmartHeroRowProps = Readonly<{
  id: string;
}>;

export const SmartHeroRow = memo(function SmartHeroRow({
  id,
}: SmartHeroRowProps) {
  const i18n = useSelector(getIntl);
  const theme = useSelector(getTheme);
  const getPreferredBadge = useSelector(getPreferredBadgeSelector);
  const hasStoriesSelector = useSelector(getHasStoriesSelector);
  const conversationSelector = useSelector(getConversationSelector);
  const conversation = conversationSelector(id);
  if (conversation == null) {
    throw new Error(`Did not find conversation ${id} in state!`);
  }
  const badge = getPreferredBadge(conversation.badges);
  const hasStories = hasStoriesSelector(id);
  const isSignalConversationValue = isSignalConversation(conversation);
  const { unblurAvatar, updateSharedGroups } = useConversationsActions();
  const { toggleAboutContactModal } = useGlobalModalActions();
  const { viewUserStories } = useStoriesActions();
  const {
    about,
    acceptedMessageRequest,
    avatarUrl,
    groupDescription,
    isMe,
    membersCount,
    phoneNumber,
    profileName,
    sharedGroupNames,
    title,
    type,
    unblurredAvatarUrl,
  } = conversation;
  return (
    <ConversationHero
      about={about}
      acceptedMessageRequest={acceptedMessageRequest}
      avatarUrl={avatarUrl}
      badge={badge}
      conversationType={type}
      groupDescription={groupDescription}
      hasStories={hasStories}
      i18n={i18n}
      id={id}
      isMe={isMe}
      isSignalConversation={isSignalConversationValue}
      membersCount={membersCount}
      phoneNumber={phoneNumber}
      profileName={profileName}
      sharedGroupNames={sharedGroupNames}
      theme={theme}
      title={title}
      toggleAboutContactModal={toggleAboutContactModal}
      unblurAvatar={unblurAvatar}
      unblurredAvatarUrl={unblurredAvatarUrl}
      updateSharedGroups={updateSharedGroups}
      viewUserStories={viewUserStories}
    />
  );
});
