// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';
import type { ConversationType } from '../state/ducks/conversations';
import type { LocalizerType } from '../types/Util';
import type { StoryViewType } from '../types/Stories';
import { Avatar, AvatarSize } from './Avatar';
import { StoryImage } from './StoryImage';
import { getAvatarColor } from '../types/Colors';

export type PropsType = {
  hasMultiple: boolean;
  i18n: LocalizerType;
  me: ConversationType;
  newestStory?: StoryViewType;
  onClick: () => unknown;
  queueStoryDownload: (storyId: string) => unknown;
};

export const MyStoriesButton = ({
  hasMultiple,
  i18n,
  me,
  newestStory,
  onClick,
  queueStoryDownload,
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

  return (
    <div className="Stories__my-stories">
      <button
        aria-label={i18n('StoryListItem__label')}
        className="StoryListItem"
        onClick={onClick}
        tabIndex={0}
        type="button"
      >
        <Avatar
          acceptedMessageRequest={acceptedMessageRequest}
          sharedGroupNames={sharedGroupNames}
          avatarPath={avatarPath}
          badge={undefined}
          color={getAvatarColor(color)}
          conversationType="direct"
          i18n={i18n}
          isMe={Boolean(isMe)}
          name={name}
          profileName={profileName}
          size={AvatarSize.FORTY_EIGHT}
          title={title}
        />
        <div className="StoryListItem__info">
          <>
            <div className="StoryListItem__info--title">
              {i18n('Stories__mine')}
            </div>
            {!newestStory && (
              <div className="StoryListItem__info--timestamp">
                {i18n('Stories__add')}
              </div>
            )}
          </>
        </div>

        <div
          className={classNames('StoryListItem__previews', {
            'StoryListItem__previews--multiple': hasMultiple,
          })}
        >
          {hasMultiple && <div className="StoryListItem__previews--more" />}
          {newestStory ? (
            <StoryImage
              attachment={newestStory.attachment}
              i18n={i18n}
              isThumbnail
              label=""
              moduleClassName="StoryListItem__previews--image"
              queueStoryDownload={queueStoryDownload}
              storyId={newestStory.messageId}
            />
          ) : (
            <div
              aria-label={i18n('Stories__add')}
              className="StoryListItem__previews--add StoryListItem__previews--image"
            />
          )}
        </div>
      </button>
    </div>
  );
};
