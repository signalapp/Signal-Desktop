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
import type { ReplyStateType } from '../types/Stories';
import type { StoryViewType } from './StoryListItem';
import { Avatar, AvatarSize } from './Avatar';
import { Intl } from './Intl';
import { MessageTimestamp } from './conversation/MessageTimestamp';
import { StoryImage } from './StoryImage';
import { StoryViewsNRepliesModal } from './StoryViewsNRepliesModal';
import { getAvatarColor } from '../types/Colors';
import { getStoryBackground } from '../util/getStoryBackground';
import { getStoryDuration } from '../util/getStoryDuration';
import { graphemeAwareSlice } from '../util/graphemeAwareSlice';
import { isDownloaded, isDownloading } from '../types/Attachment';
import { useEscapeHandling } from '../hooks/useEscapeHandling';

export type PropsType = {
  conversationId: string;
  getPreferredBadge: PreferredBadgeSelectorType;
  group?: Pick<
    ConversationType,
    | 'acceptedMessageRequest'
    | 'avatarPath'
    | 'color'
    | 'id'
    | 'name'
    | 'profileName'
    | 'sharedGroupNames'
    | 'title'
  >;
  i18n: LocalizerType;
  loadStoryReplies: (conversationId: string, messageId: string) => unknown;
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
  renderEmojiPicker: (props: RenderEmojiPickerProps) => JSX.Element;
  replyState?: ReplyStateType;
  selectedStoryIndex: number;
  skinTone?: number;
  stories: Array<StoryViewType>;
  views?: Array<string>;
};

const CAPTION_BUFFER = 20;
const CAPTION_INITIAL_LENGTH = 200;
const CAPTION_MAX_LENGTH = 700;

export const StoryViewer = ({
  conversationId,
  getPreferredBadge,
  group,
  i18n,
  loadStoryReplies,
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
  replyState,
  selectedStoryIndex,
  skinTone,
  stories,
  views,
}: PropsType): JSX.Element => {
  const [currentStoryIndex, setCurrentStoryIndex] =
    useState(selectedStoryIndex);
  const [storyDuration, setStoryDuration] = useState<number | undefined>();

  const visibleStory = stories[currentStoryIndex];

  const { attachment, canReply, messageId, timestamp } = visibleStory;
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

  // Caption related hooks
  const [hasExpandedCaption, setHasExpandedCaption] = useState<boolean>(false);

  const caption = useMemo(() => {
    if (!attachment?.caption) {
      return;
    }

    return graphemeAwareSlice(
      attachment.caption,
      hasExpandedCaption ? CAPTION_MAX_LENGTH : CAPTION_INITIAL_LENGTH,
      CAPTION_BUFFER
    );
  }, [attachment?.caption, hasExpandedCaption]);

  // Reset expansion if messageId changes
  useEffect(() => {
    setHasExpandedCaption(false);
  }, [messageId]);

  // In case we want to change the story we're viewing from 0 -> N
  useEffect(() => {
    if (selectedStoryIndex) {
      setCurrentStoryIndex(selectedStoryIndex);
    }
  }, [selectedStoryIndex]);

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

  useEffect(() => {
    let shouldCancel = false;
    (async function hydrateStoryDuration() {
      if (!attachment) {
        return;
      }
      const duration = await getStoryDuration(attachment);
      if (shouldCancel) {
        return;
      }
      setStoryDuration(duration);
    })();

    return () => {
      shouldCancel = true;
    };
  }, [attachment]);

  const [styles, spring] = useSpring(
    () => ({
      from: { width: 0 },
      to: { width: 100 },
      loop: true,
      onRest: {
        width: ({ value }) => {
          if (value === 100) {
            showNextStory();
          }
        },
      },
    }),
    [showNextStory]
  );

  // We need to be careful about this effect refreshing, it should only run
  // every time a story changes or its duration changes.
  useEffect(() => {
    if (!storyDuration) {
      spring.stop();
      return;
    }

    spring.start({
      config: {
        duration: storyDuration,
      },
      from: { width: 0 },
      to: { width: 100 },
    });

    return () => {
      spring.stop();
    };
  }, [currentStoryIndex, spring, storyDuration]);

  useEffect(() => {
    if (hasReplyModal || hasExpandedCaption) {
      spring.pause();
    } else {
      spring.resume();
    }
  }, [hasExpandedCaption, hasReplyModal, spring]);

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

  const isGroupStory = Boolean(group?.id);
  useEffect(() => {
    if (!isGroupStory) {
      return;
    }
    loadStoryReplies(conversationId, messageId);
  }, [conversationId, isGroupStory, loadStoryReplies, messageId]);

  const replies =
    replyState && replyState.messageId === messageId ? replyState.replies : [];

  const viewCount = (views || []).length;
  const replyCount = replies.length;

  return (
    <FocusTrap focusTrapOptions={{ allowOutsideClick: true }}>
      <div className="StoryViewer">
        <div
          className="StoryViewer__overlay"
          style={{ background: getStoryBackground(attachment) }}
        />
        <div className="StoryViewer__content">
          <div className="StoryViewer__container">
            <StoryImage
              attachment={attachment}
              i18n={i18n}
              label={i18n('lightboxImageAlt')}
              moduleClassName="StoryViewer__story"
              queueStoryDownload={queueStoryDownload}
              storyId={messageId}
            />
            {hasExpandedCaption && (
              <button
                aria-label={i18n('close-popup')}
                className="StoryViewer__caption__overlay"
                onClick={() => setHasExpandedCaption(false)}
                type="button"
              />
            )}
            <div className="StoryViewer__meta">
              {caption && (
                <div className="StoryViewer__caption">
                  {caption.text}
                  {caption.hasReadMore && !hasExpandedCaption && (
                    <button
                      className="MessageBody__read-more"
                      onClick={() => {
                        setHasExpandedCaption(true);
                      }}
                      onKeyDown={(ev: React.KeyboardEvent) => {
                        if (ev.key === 'Space' || ev.key === 'Enter') {
                          setHasExpandedCaption(true);
                        }
                      }}
                      type="button"
                    >
                      ...
                      {i18n('MessageBody--read-more')}
                    </button>
                  )}
                </div>
              )}
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
              <div className="StoryViewer__actions">
                {canReply && (
                  <button
                    className="StoryViewer__reply"
                    onClick={() => setHasReplyModal(true)}
                    tabIndex={0}
                    type="button"
                  >
                    <>
                      {viewCount > 0 &&
                        (viewCount === 1 ? (
                          <Intl
                            i18n={i18n}
                            id="MyStories__views--singular"
                            components={[<strong>{viewCount}</strong>]}
                          />
                        ) : (
                          <Intl
                            i18n={i18n}
                            id="MyStories__views--plural"
                            components={[<strong>{viewCount}</strong>]}
                          />
                        ))}
                      {viewCount > 0 && replyCount > 0 && ' '}
                      {replyCount > 0 &&
                        (replyCount === 1 ? (
                          <Intl
                            i18n={i18n}
                            id="MyStories__replies--singular"
                            components={[<strong>{replyCount}</strong>]}
                          />
                        ) : (
                          <Intl
                            i18n={i18n}
                            id="MyStories__replies--plural"
                            components={[<strong>{replyCount}</strong>]}
                          />
                        ))}
                      {!viewCount && !replyCount && i18n('StoryViewer__reply')}
                    </>
                  </button>
                )}
              </div>
            </div>
          </div>
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
        </div>
        {hasReplyModal && canReply && (
          <StoryViewsNRepliesModal
            authorTitle={title}
            getPreferredBadge={getPreferredBadge}
            i18n={i18n}
            isGroupStory={isGroupStory}
            isMyStory={isMe}
            onClose={() => setHasReplyModal(false)}
            onReact={emoji => {
              onReactToStory(emoji, visibleStory);
            }}
            onReply={(message, mentions, replyTimestamp) => {
              if (!isGroupStory) {
                setHasReplyModal(false);
              }
              onReplyToStory(message, mentions, replyTimestamp, visibleStory);
            }}
            onSetSkinTone={onSetSkinTone}
            onTextTooLong={onTextTooLong}
            onUseEmoji={onUseEmoji}
            preferredReactionEmoji={preferredReactionEmoji}
            recentEmojis={recentEmojis}
            renderEmojiPicker={renderEmojiPicker}
            replies={replies}
            skinTone={skinTone}
            storyPreviewAttachment={attachment}
            views={[]}
          />
        )}
      </div>
    </FocusTrap>
  );
};
