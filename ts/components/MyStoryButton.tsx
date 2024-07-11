// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';
import classNames from 'classnames';
import type { ConversationType } from '../state/ducks/conversations';
import type { LocalizerType } from '../types/Util';
import type { MyStoryType, StoryViewType } from '../types/Stories';
import type { ShowToastAction } from '../state/ducks/toast';
import { Avatar, AvatarSize } from './Avatar';
import { HasStories, ResolvedSendStatus } from '../types/Stories';
import { MessageTimestamp } from './conversation/MessageTimestamp';
import { StoriesAddStoryButton } from './StoriesAddStoryButton';
import { StoryImage } from './StoryImage';
import { getAvatarColor } from '../types/Colors';
import { reduceStorySendStatus } from '../util/resolveStorySendStatus';

export type PropsType = {
  i18n: LocalizerType;
  maxAttachmentSizeInKb: number;
  me: ConversationType;
  myStories: Array<MyStoryType>;
  onAddStory: () => unknown;
  onClick: () => unknown;
  onMediaPlaybackStart: () => void;
  queueStoryDownload: (storyId: string) => unknown;
  showToast: ShowToastAction;
};

function getNewestMyStory(story: MyStoryType): StoryViewType {
  return story.stories[0];
}

export function MyStoryButton({
  i18n,
  maxAttachmentSizeInKb,
  me,
  myStories,
  onAddStory,
  onClick,
  onMediaPlaybackStart,
  queueStoryDownload,
  showToast,
}: PropsType): JSX.Element {
  const [active, setActive] = useState(false);

  const newestStory = myStories.length
    ? getNewestMyStory(myStories[0])
    : undefined;

  const {
    acceptedMessageRequest,
    avatarUrl,
    color,
    isMe,
    profileName,
    sharedGroupNames,
    title,
  } = me;

  if (!newestStory) {
    return (
      <StoriesAddStoryButton
        i18n={i18n}
        maxAttachmentSizeInKb={maxAttachmentSizeInKb}
        moduleClassName="StoryListItem StoryListItem--active-opactiy"
        onAddStory={onAddStory}
        showToast={showToast}
      >
        <div className="MyStories__avatar-container">
          <Avatar
            acceptedMessageRequest={acceptedMessageRequest}
            avatarUrl={avatarUrl}
            badge={undefined}
            color={getAvatarColor(color)}
            conversationType="direct"
            i18n={i18n}
            isMe={Boolean(isMe)}
            profileName={profileName}
            sharedGroupNames={sharedGroupNames}
            size={AvatarSize.FORTY_EIGHT}
            title={title}
          />
          <div className="MyStories__avatar__add-story" />
        </div>
        <div className="StoryListItem__info">
          <div className="StoryListItem__info--title">
            {i18n('icu:Stories__mine')}
          </div>
          <div className="StoryListItem__info--timestamp">
            {i18n('icu:Stories__add')}
          </div>
        </div>
      </StoriesAddStoryButton>
    );
  }

  const hasMultiple = myStories.length
    ? myStories[0].stories.length > 1
    : false;

  const reducedSendStatus: ResolvedSendStatus = myStories.reduce(
    (acc: ResolvedSendStatus, myStory) =>
      reduceStorySendStatus(acc, myStory.reducedSendStatus),
    ResolvedSendStatus.Sent
  );

  return (
    <div
      className={classNames(
        'StoryListItem__button',
        active && 'StoryListItem__button--active'
      )}
    >
      <div className="MyStories__avatar-container">
        <StoriesAddStoryButton
          i18n={i18n}
          maxAttachmentSizeInKb={maxAttachmentSizeInKb}
          moduleClassName="StoryListItem--active-opacity"
          onAddStory={onAddStory}
          showToast={showToast}
          onContextMenuShowingChanged={setActive}
        >
          <Avatar
            acceptedMessageRequest={acceptedMessageRequest}
            avatarUrl={avatarUrl}
            badge={undefined}
            color={getAvatarColor(color)}
            conversationType="direct"
            i18n={i18n}
            isMe={Boolean(isMe)}
            profileName={profileName}
            sharedGroupNames={sharedGroupNames}
            size={AvatarSize.FORTY_EIGHT}
            storyRing={HasStories.Read}
            title={title}
          />
          <div className="MyStories__avatar__add-story" />
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
            {i18n('icu:MyStories__list_item')}
          </div>
          {reducedSendStatus === ResolvedSendStatus.Sending && (
            <span className="StoryListItem__info--sending">
              {i18n('icu:Stories__list--sending')}
            </span>
          )}
          {reducedSendStatus === ResolvedSendStatus.Failed && (
            <span className="StoryListItem__info--send_failed">
              {i18n('icu:Stories__list--send_failed')}
            </span>
          )}
          {reducedSendStatus === ResolvedSendStatus.PartiallySent && (
            <span className="StoryListItem__info--send_failed">
              {i18n('icu:Stories__list--partially-sent')}
            </span>
          )}
          {reducedSendStatus === ResolvedSendStatus.Sent && (
            <MessageTimestamp
              i18n={i18n}
              isRelativeTime
              module="StoryListItem__info--timestamp"
              timestamp={newestStory.timestamp}
            />
          )}
        </div>
        <div
          aria-label={i18n('icu:StoryListItem__label')}
          className={classNames('StoryListItem__previews', {
            'StoryListItem__previews--multiple': hasMultiple,
          })}
        >
          {hasMultiple && <div className="StoryListItem__previews--more" />}
          <StoryImage
            attachment={newestStory.attachment}
            firstName={i18n('icu:you')}
            i18n={i18n}
            isMe
            isThumbnail
            label=""
            moduleClassName="StoryListItem__previews--image"
            queueStoryDownload={queueStoryDownload}
            storyId={newestStory.messageId}
            onMediaPlaybackStart={onMediaPlaybackStart}
          />
        </div>
      </div>
    </div>
  );
}
