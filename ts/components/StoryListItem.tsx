// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';
import classNames from 'classnames';
import type { ConversationType } from '../state/ducks/conversations';
import type { ConversationStoryType, StoryViewType } from '../types/Stories';
import type { LocalizerType } from '../types/Util';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges';
import { Avatar, AvatarSize } from './Avatar';
import { ConfirmationDialog } from './ConfirmationDialog';
import { ContextMenu } from './ContextMenu';
import { HasStories } from '../types/Stories';
import { MessageTimestamp } from './conversation/MessageTimestamp';
import { StoryImage } from './StoryImage';
import { ThemeType } from '../types/Util';
import { getAvatarColor } from '../types/Colors';

export type PropsType = Pick<ConversationStoryType, 'group' | 'isHidden'> & {
  conversationId: string;
  getPreferredBadge: PreferredBadgeSelectorType;
  i18n: LocalizerType;
  onGoToConversation: (conversationId: string) => unknown;
  onHideStory: (conversationId: string) => unknown;
  queueStoryDownload: (storyId: string) => unknown;
  story: StoryViewType;
  viewUserStories: (
    conversationId: string,
    shouldShowDetailsModal?: boolean
  ) => unknown;
};

function StoryListItemAvatar({
  acceptedMessageRequest,
  avatarPath,
  avatarStoryRing,
  badges,
  color,
  getPreferredBadge,
  i18n,
  isMe,
  name,
  profileName,
  sharedGroupNames,
  title,
}: Pick<
  ConversationType,
  | 'acceptedMessageRequest'
  | 'avatarPath'
  | 'color'
  | 'name'
  | 'profileName'
  | 'sharedGroupNames'
  | 'title'
> & {
  avatarStoryRing?: HasStories;
  badges?: ConversationType['badges'];
  getPreferredBadge: PreferredBadgeSelectorType;
  i18n: LocalizerType;
  isMe?: boolean;
}): JSX.Element {
  return (
    <Avatar
      acceptedMessageRequest={acceptedMessageRequest}
      avatarPath={avatarPath}
      badge={badges ? getPreferredBadge(badges) : undefined}
      color={getAvatarColor(color)}
      conversationType="direct"
      i18n={i18n}
      isMe={Boolean(isMe)}
      name={name}
      profileName={profileName}
      sharedGroupNames={sharedGroupNames}
      size={AvatarSize.FORTY_EIGHT}
      storyRing={avatarStoryRing}
      theme={ThemeType.dark}
      title={title}
    />
  );
}

export const StoryListItem = ({
  conversationId,
  getPreferredBadge,
  group,
  i18n,
  isHidden,
  onGoToConversation,
  onHideStory,
  queueStoryDownload,
  story,
  viewUserStories,
}: PropsType): JSX.Element => {
  const [hasConfirmHideStory, setHasConfirmHideStory] = useState(false);

  const {
    attachment,
    hasReplies,
    hasRepliesFromSelf,
    isUnread,
    sender,
    timestamp,
  } = story;

  const { firstName, title } = sender;

  let avatarStoryRing: HasStories | undefined;
  if (attachment) {
    avatarStoryRing = isUnread ? HasStories.Unread : HasStories.Read;
  }

  let repliesElement: JSX.Element | undefined;
  if (hasRepliesFromSelf) {
    repliesElement = <div className="StoryListItem__info--replies--self" />;
  } else if (hasReplies) {
    repliesElement = <div className="StoryListItem__info--replies--others" />;
  }

  return (
    <>
      <ContextMenu
        aria-label={i18n('StoryListItem__label')}
        i18n={i18n}
        menuOptions={[
          {
            icon: 'StoryListItem__icon--hide',
            label: isHidden
              ? i18n('StoryListItem__unhide')
              : i18n('StoryListItem__hide'),
            onClick: () => {
              if (isHidden) {
                onHideStory(conversationId);
              } else {
                setHasConfirmHideStory(true);
              }
            },
          },
          {
            icon: 'StoryListItem__icon--info',
            label: i18n('StoryListItem__info'),
            onClick: () => viewUserStories(conversationId, true),
          },
          {
            icon: 'StoryListItem__icon--chat',
            label: i18n('StoryListItem__go-to-chat'),
            onClick: () => onGoToConversation(conversationId),
          },
        ]}
        moduleClassName={classNames('StoryListItem', {
          'StoryListItem--hidden': isHidden,
        })}
        onClick={() => viewUserStories(conversationId)}
        popperOptions={{
          placement: 'bottom',
          strategy: 'absolute',
        }}
      >
        <StoryListItemAvatar
          avatarStoryRing={avatarStoryRing}
          getPreferredBadge={getPreferredBadge}
          i18n={i18n}
          {...(group || sender)}
        />
        <div className="StoryListItem__info">
          <>
            <div className="StoryListItem__info--title">
              {group ? group.title : title}
            </div>
            <MessageTimestamp
              i18n={i18n}
              isRelativeTime
              module="StoryListItem__info--timestamp"
              timestamp={timestamp}
            />
          </>
          {repliesElement}
        </div>

        <div className="StoryListItem__previews">
          <StoryImage
            attachment={attachment}
            firstName={firstName || title}
            i18n={i18n}
            isThumbnail
            label=""
            moduleClassName="StoryListItem__previews--image"
            queueStoryDownload={queueStoryDownload}
            storyId={story.messageId}
          />
        </div>
      </ContextMenu>
      {hasConfirmHideStory && (
        <ConfirmationDialog
          actions={[
            {
              action: () => onHideStory(conversationId),
              style: 'affirmative',
              text: i18n('StoryListItem__hide-modal--confirm'),
            },
          ]}
          i18n={i18n}
          onClose={() => {
            setHasConfirmHideStory(false);
          }}
        >
          {i18n('StoryListItem__hide-modal--body', [String(firstName)])}
        </ConfirmationDialog>
      )}
    </>
  );
};
