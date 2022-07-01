// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';
import classNames from 'classnames';
import type { LocalizerType } from '../types/Util';
import type { ConversationStoryType, StoryViewType } from '../types/Stories';
import { Avatar, AvatarSize, AvatarStoryRing } from './Avatar';
import { ConfirmationDialog } from './ConfirmationDialog';
import { ContextMenuPopper } from './ContextMenu';
import { MessageTimestamp } from './conversation/MessageTimestamp';
import { StoryImage } from './StoryImage';
import { getAvatarColor } from '../types/Colors';

export type PropsType = Pick<ConversationStoryType, 'group' | 'isHidden'> & {
  i18n: LocalizerType;
  onClick: () => unknown;
  onGoToConversation: (conversationId: string) => unknown;
  onHideStory: (conversationId: string) => unknown;
  queueStoryDownload: (storyId: string) => unknown;
  story: StoryViewType;
};

export const StoryListItem = ({
  group,
  i18n,
  isHidden,
  onClick,
  onGoToConversation,
  onHideStory,
  queueStoryDownload,
  story,
}: PropsType): JSX.Element => {
  const [hasConfirmHideStory, setHasConfirmHideStory] = useState(false);
  const [isShowingContextMenu, setIsShowingContextMenu] = useState(false);
  const [referenceElement, setReferenceElement] =
    useState<HTMLButtonElement | null>(null);

  const {
    attachment,
    hasReplies,
    hasRepliesFromSelf,
    isUnread,
    sender,
    timestamp,
  } = story;

  const {
    acceptedMessageRequest,
    avatarPath,
    color,
    firstName,
    isMe,
    name,
    profileName,
    sharedGroupNames,
    title,
  } = sender;

  let avatarStoryRing: AvatarStoryRing | undefined;
  if (attachment) {
    avatarStoryRing = isUnread ? AvatarStoryRing.Unread : AvatarStoryRing.Read;
  }

  let repliesElement: JSX.Element | undefined;
  if (hasRepliesFromSelf) {
    repliesElement = <div className="StoryListItem__info--replies--self" />;
  } else if (hasReplies) {
    repliesElement = <div className="StoryListItem__info--replies--others" />;
  }

  return (
    <>
      <button
        aria-label={i18n('StoryListItem__label')}
        className={classNames('StoryListItem', {
          'StoryListItem--hidden': isHidden,
        })}
        onClick={onClick}
        onContextMenu={ev => {
          ev.preventDefault();
          ev.stopPropagation();

          setIsShowingContextMenu(true);
        }}
        ref={setReferenceElement}
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
          storyRing={avatarStoryRing}
          title={title}
        />
        <div className="StoryListItem__info">
          <>
            <div className="StoryListItem__info--title">
              {group
                ? i18n('Stories__from-to-group', {
                    name: title,
                    group: group.title,
                  })
                : title}
            </div>
            <MessageTimestamp
              i18n={i18n}
              module="StoryListItem__info--timestamp"
              timestamp={timestamp}
            />
          </>
          {repliesElement}
        </div>

        <div className="StoryListItem__previews">
          <StoryImage
            attachment={attachment}
            i18n={i18n}
            isThumbnail
            label=""
            moduleClassName="StoryListItem__previews--image"
            queueStoryDownload={queueStoryDownload}
            storyId={story.messageId}
          />
        </div>
      </button>
      <ContextMenuPopper
        isMenuShowing={isShowingContextMenu}
        menuOptions={[
          {
            icon: 'StoryListItem__icon--hide',
            label: isHidden
              ? i18n('StoryListItem__unhide')
              : i18n('StoryListItem__hide'),
            onClick: () => {
              if (isHidden) {
                onHideStory(sender.id);
              } else {
                setHasConfirmHideStory(true);
              }
            },
          },
          {
            icon: 'StoryListItem__icon--chat',
            label: i18n('StoryListItem__go-to-chat'),
            onClick: () => {
              onGoToConversation(sender.id);
            },
          },
        ]}
        onClose={() => setIsShowingContextMenu(false)}
        popperOptions={{
          placement: 'bottom',
          strategy: 'absolute',
        }}
        referenceElement={referenceElement}
      />
      {hasConfirmHideStory && (
        <ConfirmationDialog
          actions={[
            {
              action: () => onHideStory(sender.id),
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
