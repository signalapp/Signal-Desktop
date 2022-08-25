// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';
import type { ConversationType } from '../state/ducks/conversations';
import type { LocalizerType } from '../types/Util';
import type { ShowToastActionCreatorType } from '../state/ducks/toast';
import type { StoryViewType } from '../types/Stories';
import { Avatar, AvatarSize } from './Avatar';
import { HasStories } from '../types/Stories';
import { StoryImage } from './StoryImage';
import { getAvatarColor } from '../types/Colors';
import { MessageTimestamp } from './conversation/MessageTimestamp';

import { StoriesAddStoryButton } from './StoriesAddStoryButton';

export type PropsType = {
  hasMultiple: boolean;
  i18n: LocalizerType;
  me: ConversationType;
  newestStory?: StoryViewType;
  onAddStory: () => unknown;
  onClick: () => unknown;
  queueStoryDownload: (storyId: string) => unknown;
  showToast: ShowToastActionCreatorType;
};

export const MyStoriesButton = ({
  hasMultiple,
  i18n,
  me,
  newestStory,
  onAddStory,
  onClick,
  queueStoryDownload,
  showToast,
}: PropsType): JSX.Element => {
  const {
    acceptedMessageRequest,
    avatarPath,
    color,
    isMe,
    name,
    profileName,
    sharedGroupNames,
    title,
  } = me;

  if (!newestStory) {
    return (
      <StoriesAddStoryButton
        i18n={i18n}
        moduleClassName="StoryListItem StoryListItem--active-opactiy"
        onAddStory={onAddStory}
        showToast={showToast}
      >
        <div className="MyStories__avatar-container">
          <Avatar
            acceptedMessageRequest={acceptedMessageRequest}
            avatarPath={avatarPath}
            badge={undefined}
            color={getAvatarColor(color)}
            conversationType="direct"
            i18n={i18n}
            isMe={Boolean(isMe)}
            name={name}
            profileName={profileName}
            sharedGroupNames={sharedGroupNames}
            size={AvatarSize.FORTY_EIGHT}
            title={title}
          />
          <div
            aria-label={i18n('Stories__add')}
            className="MyStories__avatar__add-story"
          />
        </div>
        <div className="StoryListItem__info">
          <>
            <div className="StoryListItem__info--title">
              {i18n('Stories__mine')}
            </div>
            <div className="StoryListItem__info--timestamp">
              {i18n('Stories__add')}
            </div>
          </>
        </div>
      </StoriesAddStoryButton>
    );
  }

  return (
    <div className="StoryListItem__button">
      <div className="MyStories__avatar-container">
        <StoriesAddStoryButton
          i18n={i18n}
          moduleClassName="StoryListItem--active-opacity"
          onAddStory={onAddStory}
          showToast={showToast}
        >
          <Avatar
            acceptedMessageRequest={acceptedMessageRequest}
            avatarPath={avatarPath}
            badge={undefined}
            color={getAvatarColor(color)}
            conversationType="direct"
            i18n={i18n}
            isMe={Boolean(isMe)}
            name={name}
            profileName={profileName}
            sharedGroupNames={sharedGroupNames}
            size={AvatarSize.FORTY_EIGHT}
            storyRing={HasStories.Read}
            title={title}
          />
          <div
            aria-label={i18n('Stories__add')}
            className="MyStories__avatar__add-story"
          />
        </StoriesAddStoryButton>
      </div>
      <div
        className="StoryListItem__click-container StoryListItem--active-opacity"
        onClick={onClick}
        onKeyDown={ev => {
          if (ev.key === 'Enter') {
            onClick();
            ev.stopPropagation();
            ev.preventDefault();
          }
        }}
        role="button"
        tabIndex={0}
      >
        <div className="StoryListItem__info">
          <div className="StoryListItem__info--title StoryListItem__chevron">
            {i18n('Stories__mine')}
          </div>
          <MessageTimestamp
            i18n={i18n}
            isRelativeTime
            module="StoryListItem__info--timestamp"
            timestamp={newestStory.timestamp}
          />
        </div>
        <div
          aria-label={i18n('StoryListItem__label')}
          className={classNames('StoryListItem__previews', {
            'StoryListItem__previews--multiple': hasMultiple,
          })}
        >
          {hasMultiple && <div className="StoryListItem__previews--more" />}
          <StoryImage
            attachment={newestStory.attachment}
            firstName={i18n('you')}
            i18n={i18n}
            isMe
            isThumbnail
            label=""
            moduleClassName="StoryListItem__previews--image"
            queueStoryDownload={queueStoryDownload}
            storyId={newestStory.messageId}
          />
        </div>
      </div>
    </div>
  );
};
