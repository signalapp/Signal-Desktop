// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import FocusTrap from 'focus-trap-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSpring, animated, to } from '@react-spring/web';
import type { BodyRangeType, LocalizerType } from '../types/Util';
import type { ConversationType } from '../state/ducks/conversations';
import type { EmojiPickDataType } from './emoji/EmojiPicker';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges';
import type { RenderEmojiPickerProps } from './conversation/ReactionPicker';
import type { StoryViewType } from './StoryListItem';
import { Avatar, AvatarSize } from './Avatar';
import { Intl } from './Intl';
import { MessageTimestamp } from './conversation/MessageTimestamp';
import { StoryImage } from './StoryImage';
import { StoryViewsNRepliesModal } from './StoryViewsNRepliesModal';
import { isDownloaded, isDownloading } from '../types/Attachment';
import { getAvatarColor } from '../types/Colors';
import { useEscapeHandling } from '../hooks/useEscapeHandling';

const STORY_DURATION = 5000;

export type PropsType = {
  getPreferredBadge: PreferredBadgeSelectorType;
  group?: ConversationType;
  i18n: LocalizerType;
  markStoryRead: (mId: string) => unknown;
  onClose: () => unknown;
  onNextUserStories: () => unknown;
  onPrevUserStories: () => unknown;
  onSetSkinTone: (tone: number) => unknown;
  onTextTooLong: () => unknown;
  onReactToStory: (emoji: string, story: StoryViewType) => unknown;
  onReplyToStory: (
    message: string,
    mentions: Array<BodyRangeType>,
    timestamp: number,
    story: StoryViewType
  ) => unknown;
  onUseEmoji: (_: EmojiPickDataType) => unknown;
  preferredReactionEmoji: Array<string>;
  queueStoryDownload: (storyId: string) => unknown;
  recentEmojis?: Array<string>;
  replies?: number;
  renderEmojiPicker: (props: RenderEmojiPickerProps) => JSX.Element;
  skinTone?: number;
  stories: Array<StoryViewType>;
  views?: number;
};

export const StoryViewer = ({
  getPreferredBadge,
  group,
  i18n,
  markStoryRead,
  onClose,
  onNextUserStories,
  onPrevUserStories,
  onReactToStory,
  onReplyToStory,
  onSetSkinTone,
  onTextTooLong,
  onUseEmoji,
  preferredReactionEmoji,
  queueStoryDownload,
  recentEmojis,
  renderEmojiPicker,
  replies,
  skinTone,
  stories,
  views,
}: PropsType): JSX.Element => {
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);

  const visibleStory = stories[currentStoryIndex];

  const { attachment, messageId, timestamp } = visibleStory;
  const {
    acceptedMessageRequest,
    avatarPath,
    color,
    isMe,
    name,
    profileName,
    sharedGroupNames,
    title,
  } = visibleStory.sender;

  const [hasReplyModal, setHasReplyModal] = useState(false);

  const onEscape = useCallback(() => {
    if (hasReplyModal) {
      setHasReplyModal(false);
    } else {
      onClose();
    }
  }, [hasReplyModal, onClose]);

  useEscapeHandling(onEscape);

  // Either we show the next story in the current user's stories or we ask
  // for the next user's stories.
  const showNextStory = useCallback(() => {
    if (currentStoryIndex < stories.length - 1) {
      setCurrentStoryIndex(currentStoryIndex + 1);
    } else {
      setCurrentStoryIndex(0);
      onNextUserStories();
    }
  }, [currentStoryIndex, onNextUserStories, stories.length]);

  // Either we show the previous story in the current user's stories or we ask
  // for the prior user's stories.
  const showPrevStory = useCallback(() => {
    if (currentStoryIndex === 0) {
      onPrevUserStories();
    } else {
      setCurrentStoryIndex(currentStoryIndex - 1);
    }
  }, [currentStoryIndex, onPrevUserStories]);

  const [styles, spring] = useSpring(() => ({
    config: {
      duration: STORY_DURATION,
    },
    from: { width: 0 },
    to: { width: 100 },
    loop: true,
  }));

  // Adding "currentStoryIndex" to the dependency list here to explcitly signal
  // that this useEffect should run whenever the story changes.
  useEffect(() => {
    spring.start({
      from: { width: 0 },
      to: { width: 100 },
      onRest: {
        width: ({ value }) => {
          if (value === 100) {
            showNextStory();
          }
        },
      },
    });

    return () => {
      spring.stop();
    };
  }, [currentStoryIndex, showNextStory, spring]);

  useEffect(() => {
    if (hasReplyModal) {
      spring.pause();
    } else {
      spring.resume();
    }
  }, [hasReplyModal, spring]);

  useEffect(() => {
    markStoryRead(messageId);
  }, [markStoryRead, messageId]);

  // Queue all undownloaded stories once we're viewing someone's stories
  const storiesToDownload = useMemo(() => {
    return stories
      .filter(
        story =>
          !isDownloaded(story.attachment) && !isDownloading(story.attachment)
      )
      .map(story => story.messageId);
  }, [stories]);
  useEffect(() => {
    storiesToDownload.forEach(id => queueStoryDownload(id));
  }, [queueStoryDownload, storiesToDownload]);

  const navigateStories = useCallback(
    (ev: KeyboardEvent) => {
      if (ev.key === 'ArrowRight') {
        showNextStory();
        ev.preventDefault();
        ev.stopPropagation();
      } else if (ev.key === 'ArrowLeft') {
        showPrevStory();
        ev.preventDefault();
        ev.stopPropagation();
      }
    },
    [showPrevStory, showNextStory]
  );

  useEffect(() => {
    document.addEventListener('keydown', navigateStories);

    return () => {
      document.removeEventListener('keydown', navigateStories);
    };
  }, [navigateStories]);

  return (
    <FocusTrap focusTrapOptions={{ allowOutsideClick: true }}>
      <div className="StoryViewer">
        <div className="StoryViewer__overlay" />
        <div className="StoryViewer__content">
          <button
            aria-label={i18n('MyStories__more')}
            className="StoryViewer__more"
            tabIndex={0}
            type="button"
          />
          <button
            aria-label={i18n('close')}
            className="StoryViewer__close-button"
            onClick={onClose}
            tabIndex={0}
            type="button"
          />
          <div className="StoryViewer__container">
            <StoryImage
              attachment={attachment}
              i18n={i18n}
              label={i18n('lightboxImageAlt')}
              moduleClassName="StoryViewer__story"
              queueStoryDownload={queueStoryDownload}
              storyId={messageId}
            />
            <div className="StoryViewer__meta">
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
                size={AvatarSize.TWENTY_EIGHT}
                title={title}
              />
              {group && (
                <Avatar
                  acceptedMessageRequest={group.acceptedMessageRequest}
                  avatarPath={group.avatarPath}
                  badge={undefined}
                  className="StoryViewer__meta--group-avatar"
                  color={getAvatarColor(group.color)}
                  conversationType="group"
                  i18n={i18n}
                  isMe={false}
                  name={group.name}
                  profileName={group.profileName}
                  sharedGroupNames={group.sharedGroupNames}
                  size={AvatarSize.TWENTY_EIGHT}
                  title={group.title}
                />
              )}
              <div className="StoryViewer__meta--title">
                {group
                  ? i18n('Stories__from-to-group', {
                      name: title,
                      group: group.title,
                    })
                  : title}
              </div>
              <MessageTimestamp
                i18n={i18n}
                module="StoryViewer__meta--timestamp"
                timestamp={timestamp}
              />
              <div className="StoryViewer__progress">
                {stories.map((story, index) => (
                  <div
                    className="StoryViewer__progress--container"
                    key={story.messageId}
                  >
                    {currentStoryIndex === index ? (
                      <animated.div
                        className="StoryViewer__progress--bar"
                        style={{
                          width: to([styles.width], width => `${width}%`),
                        }}
                      />
                    ) : (
                      <div
                        className="StoryViewer__progress--bar"
                        style={{
                          width: currentStoryIndex < index ? '0%' : '100%',
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="StoryViewer__actions">
            {isMe ? (
              <>
                {views &&
                  (views === 1 ? (
                    <Intl
                      i18n={i18n}
                      id="MyStories__views--singular"
                      components={[<strong>{views}</strong>]}
                    />
                  ) : (
                    <Intl
                      i18n={i18n}
                      id="MyStories__views--plural"
                      components={[<strong>{views}</strong>]}
                    />
                  ))}
                {views && replies && ' '}
                {replies &&
                  (replies === 1 ? (
                    <Intl
                      i18n={i18n}
                      id="MyStories__replies--singular"
                      components={[<strong>{replies}</strong>]}
                    />
                  ) : (
                    <Intl
                      i18n={i18n}
                      id="MyStories__replies--plural"
                      components={[<strong>{replies}</strong>]}
                    />
                  ))}
              </>
            ) : (
              <button
                className="StoryViewer__reply"
                onClick={() => setHasReplyModal(true)}
                tabIndex={0}
                type="button"
              >
                {i18n('StoryViewer__reply')}
              </button>
            )}
          </div>
        </div>
        {hasReplyModal && (
          <StoryViewsNRepliesModal
            authorTitle={title}
            getPreferredBadge={getPreferredBadge}
            i18n={i18n}
            isMyStory={isMe}
            onClose={() => setHasReplyModal(false)}
            onReact={emoji => {
              onReactToStory(emoji, visibleStory);
            }}
            onReply={(message, mentions, replyTimestamp) => {
              setHasReplyModal(false);
              onReplyToStory(message, mentions, replyTimestamp, visibleStory);
            }}
            onSetSkinTone={onSetSkinTone}
            onTextTooLong={onTextTooLong}
            onUseEmoji={onUseEmoji}
            preferredReactionEmoji={preferredReactionEmoji}
            recentEmojis={recentEmojis}
            renderEmojiPicker={renderEmojiPicker}
            replies={[]}
            skinTone={skinTone}
            storyPreviewAttachment={attachment}
            views={[]}
          />
        )}
      </div>
    </FocusTrap>
  );
};
