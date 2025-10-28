// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';
import classNames from 'classnames';
import type {
  ConversationStoryType,
  StoryViewType,
} from '../types/Stories.std.js';
import type { ConversationType } from '../state/ducks/conversations.preload.js';
import type { LocalizerType, ThemeType } from '../types/Util.std.js';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges.preload.js';
import type { ViewUserStoriesActionCreatorType } from '../state/ducks/stories.preload.js';
import { Avatar, AvatarSize } from './Avatar.dom.js';
import { ConfirmationDialog } from './ConfirmationDialog.dom.js';
import { ContextMenu } from './ContextMenu.dom.js';
import { SIGNAL_ACI } from '../types/SignalConversation.std.js';
import { StoryViewTargetType, HasStories } from '../types/Stories.std.js';

import { MessageTimestamp } from './conversation/MessageTimestamp.dom.js';
import { StoryImage } from './StoryImage.dom.js';
import { getAvatarColor } from '../types/Colors.std.js';

export type PropsType = Pick<ConversationStoryType, 'group' | 'isHidden'> & {
  conversationId: string;
  getPreferredBadge: PreferredBadgeSelectorType;
  hasReplies?: boolean;
  hasRepliesFromSelf?: boolean;
  i18n: LocalizerType;
  onGoToConversation: (conversationId: string) => unknown;
  onHideStory: (conversationId: string) => unknown;
  queueStoryDownload: (storyId: string) => unknown;
  onMediaPlaybackStart: () => void;
  story: StoryViewType;
  theme: ThemeType;
  viewUserStories: ViewUserStoriesActionCreatorType;
};

function StoryListItemAvatar({
  avatarPlaceholderGradient,
  avatarUrl,
  avatarStoryRing,
  badges,
  color,
  getPreferredBadge,
  i18n,
  profileName,
  sharedGroupNames,
  title,
  theme,
}: Pick<
  ConversationType,
  | 'avatarPlaceholderGradient'
  | 'avatarUrl'
  | 'color'
  | 'profileName'
  | 'sharedGroupNames'
  | 'title'
> & {
  avatarStoryRing?: HasStories;
  badges?: ConversationType['badges'];
  getPreferredBadge: PreferredBadgeSelectorType;
  i18n: LocalizerType;
  theme: ThemeType;
}): JSX.Element {
  return (
    <Avatar
      avatarPlaceholderGradient={avatarPlaceholderGradient}
      avatarUrl={avatarUrl}
      badge={badges ? getPreferredBadge(badges) : undefined}
      color={getAvatarColor(color)}
      conversationType="direct"
      i18n={i18n}
      profileName={profileName}
      sharedGroupNames={sharedGroupNames}
      size={AvatarSize.FORTY_EIGHT}
      storyRing={avatarStoryRing}
      theme={theme}
      title={title}
    />
  );
}

export function StoryListItem({
  conversationId,
  getPreferredBadge,
  group,
  hasReplies,
  hasRepliesFromSelf,
  i18n,
  isHidden,
  onGoToConversation,
  onHideStory,
  onMediaPlaybackStart,
  queueStoryDownload,
  story,
  theme,
  viewUserStories,
}: PropsType): JSX.Element {
  const [hasConfirmHideStory, setHasConfirmHideStory] = useState(false);

  const { attachment, isUnread, sender, timestamp } = story;

  const { firstName, title } = sender;

  const isSignalOfficial = sender.serviceId === SIGNAL_ACI;

  let avatarStoryRing: HasStories | undefined;
  if (attachment) {
    avatarStoryRing = isUnread ? HasStories.Unread : HasStories.Read;
  }

  let repliesElement: JSX.Element | undefined;
  if (group === undefined && hasRepliesFromSelf) {
    repliesElement = <div className="StoryListItem__info--replies--self" />;
  } else if (group && (hasReplies || hasRepliesFromSelf)) {
    repliesElement = <div className="StoryListItem__info--replies--others" />;
  }

  const menuOptions = [];
  if (isHidden) {
    menuOptions.push({
      icon: 'StoryListItem__icon--unhide',
      label: i18n('icu:StoryListItem__unhide'),
      onClick: () => {
        onHideStory(conversationId);
      },
    });
  } else {
    menuOptions.push({
      icon: 'StoryListItem__icon--hide',
      label: i18n('icu:StoryListItem__hide'),
      onClick: () => {
        setHasConfirmHideStory(true);
      },
    });
  }

  if (!isSignalOfficial) {
    menuOptions.push({
      icon: 'StoryListItem__icon--info',
      label: i18n('icu:StoryListItem__info'),
      onClick: () =>
        viewUserStories({
          conversationId,
          viewTarget: StoryViewTargetType.Details,
        }),
    });

    menuOptions.push({
      icon: 'StoryListItem__icon--chat',
      label: i18n('icu:StoryListItem__go-to-chat'),
      onClick: () => onGoToConversation(conversationId),
    });
  }

  return (
    <>
      <ContextMenu
        aria-label={i18n('icu:StoryListItem__label')}
        i18n={i18n}
        menuOptions={menuOptions}
        moduleClassName={classNames('StoryListItem', {
          'StoryListItem--hidden': isHidden,
        })}
        onClick={() => viewUserStories({ conversationId })}
        popperOptions={{
          placement: 'bottom',
          strategy: 'absolute',
        }}
      >
        <StoryListItemAvatar
          avatarStoryRing={avatarStoryRing}
          getPreferredBadge={getPreferredBadge}
          i18n={i18n}
          theme={theme}
          {...(group || sender)}
        />
        <div className="StoryListItem__info">
          <div className="StoryListItem__info--title">
            {group ? group.title : title}
            {isSignalOfficial && (
              <span className="ContactModal__official-badge" />
            )}
          </div>
          {!isSignalOfficial && (
            <MessageTimestamp
              i18n={i18n}
              isRelativeTime
              module="StoryListItem__info--timestamp"
              timestamp={timestamp}
            />
          )}
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
            onMediaPlaybackStart={onMediaPlaybackStart}
          />
        </div>
      </ContextMenu>
      {hasConfirmHideStory && (
        <ConfirmationDialog
          dialogName="StoryListItem.hideStory"
          actions={[
            {
              action: () => onHideStory(conversationId),
              style: 'affirmative',
              text: i18n('icu:StoryListItem__hide-modal--confirm'),
            },
          ]}
          i18n={i18n}
          onClose={() => {
            setHasConfirmHideStory(false);
          }}
        >
          {i18n('icu:StoryListItem__hide-modal--body', {
            name: String(firstName),
          })}
        </ConfirmationDialog>
      )}
    </>
  );
}
