// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import FocusTrap from 'focus-trap-react';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import classNames from 'classnames';
import { useSpring, animated, to } from '@react-spring/web';
import type { BodyRangeType, LocalizerType } from '../types/Util';
import type { ContextMenuOptionType } from './ContextMenu';
import type { ConversationType } from '../state/ducks/conversations';
import type { EmojiPickDataType } from './emoji/EmojiPicker';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges';
import type { RenderEmojiPickerProps } from './conversation/ReactionPicker';
import type { ReplyStateType, StoryViewType } from '../types/Stories';
import type { ShowToastActionCreatorType } from '../state/ducks/toast';
import type { ViewStoryActionCreatorType } from '../state/ducks/stories';
import * as log from '../logging/log';
import { AnimatedEmojiGalore } from './AnimatedEmojiGalore';
import { Avatar, AvatarSize } from './Avatar';
import { ConfirmationDialog } from './ConfirmationDialog';
import { ContextMenu } from './ContextMenu';
import { Intl } from './Intl';
import { MessageTimestamp } from './conversation/MessageTimestamp';
import { SendStatus } from '../messages/MessageSendState';
import { StoryDetailsModal } from './StoryDetailsModal';
import { StoryViewsNRepliesModal } from './StoryViewsNRepliesModal';
import { StoryImage } from './StoryImage';
import { StoryViewDirectionType, StoryViewModeType } from '../types/Stories';
import { Theme } from '../util/theme';
import { ToastType } from '../state/ducks/toast';
import { getAvatarColor } from '../types/Colors';
import { getStoryBackground } from '../util/getStoryBackground';
import { getStoryDuration } from '../util/getStoryDuration';
import { isVideoAttachment } from '../types/Attachment';
import { graphemeAwareSlice } from '../util/graphemeAwareSlice';
import { useEscapeHandling } from '../hooks/useEscapeHandling';

export type PropsType = {
  currentIndex: number;
  deleteStoryForEveryone: (story: StoryViewType) => unknown;
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
  hasActiveCall?: boolean;
  hasAllStoriesMuted: boolean;
  i18n: LocalizerType;
  loadStoryReplies: (conversationId: string, messageId: string) => unknown;
  markStoryRead: (mId: string) => unknown;
  numStories: number;
  onGoToConversation: (conversationId: string) => unknown;
  onHideStory: (conversationId: string) => unknown;
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
  shouldShowDetailsModal?: boolean;
  showToast: ShowToastActionCreatorType;
  skinTone?: number;
  story: StoryViewType;
  storyViewMode?: StoryViewModeType;
  toggleHasAllStoriesMuted: () => unknown;
  viewStory: ViewStoryActionCreatorType;
};

const CAPTION_BUFFER = 20;
const CAPTION_INITIAL_LENGTH = 200;
const CAPTION_MAX_LENGTH = 700;
const MOUSE_IDLE_TIME = 3000;

enum Arrow {
  None,
  Left,
  Right,
}

export const StoryViewer = ({
  currentIndex,
  deleteStoryForEveryone,
  getPreferredBadge,
  group,
  hasActiveCall,
  hasAllStoriesMuted,
  i18n,
  loadStoryReplies,
  markStoryRead,
  numStories,
  onGoToConversation,
  onHideStory,
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
  shouldShowDetailsModal,
  showToast,
  skinTone,
  story,
  storyViewMode,
  toggleHasAllStoriesMuted,
  viewStory,
}: PropsType): JSX.Element => {
  const [isShowingContextMenu, setIsShowingContextMenu] =
    useState<boolean>(false);
  const [storyDuration, setStoryDuration] = useState<number | undefined>();
  const [hasConfirmHideStory, setHasConfirmHideStory] = useState(false);
  const [reactionEmoji, setReactionEmoji] = useState<string | undefined>();
  const [confirmDeleteStory, setConfirmDeleteStory] = useState<
    StoryViewType | undefined
  >();

  const { attachment, canReply, isHidden, messageId, sendState, timestamp } =
    story;
  const {
    acceptedMessageRequest,
    avatarPath,
    color,
    isMe,
    id,
    firstName,
    name,
    profileName,
    sharedGroupNames,
    title,
  } = story.sender;

  const [hasStoryViewsNRepliesModal, setHasStoryViewsNRepliesModal] =
    useState(false);
  const [hasStoryDetailsModal, setHasStoryDetailsModal] = useState(
    Boolean(shouldShowDetailsModal)
  );

  const onClose = useCallback(() => {
    viewStory({
      closeViewer: true,
    });
  }, [viewStory]);

  const onEscape = useCallback(() => {
    if (hasStoryViewsNRepliesModal) {
      setHasStoryViewsNRepliesModal(false);
    } else {
      onClose();
    }
  }, [hasStoryViewsNRepliesModal, onClose]);

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

  // messageId is set as a dependency so that we can reset the story duration
  // when a new story is selected in case the same story (and same attachment)
  // are sequentially posted.
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
      log.info('stories.setStoryDuration', {
        contentType: attachment.textAttachment
          ? 'text'
          : attachment.contentType,
        duration,
      });
      setStoryDuration(duration);
    })();

    return () => {
      shouldCancel = true;
    };
  }, [attachment, messageId]);

  const unmountRef = useRef<boolean>(false);
  useEffect(() => {
    return () => {
      unmountRef.current = true;
    };
  }, []);

  const [styles, spring] = useSpring(
    () => ({
      from: { width: 0 },
      to: { width: 100 },
      loop: true,
      onRest: {
        width: ({ value }) => {
          if (unmountRef.current) {
            log.info(
              'stories.StoryViewer.spring.onRest: called after component unmounted'
            );
            return;
          }

          if (value === 100) {
            viewStory({
              storyId: story.messageId,
              storyViewMode,
              viewDirection: StoryViewDirectionType.Next,
            });
          }
        },
      },
    }),
    [story.messageId, storyViewMode, viewStory]
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
  }, [currentIndex, spring, storyDuration]);

  const [pauseStory, setPauseStory] = useState(false);

  const shouldPauseViewing =
    hasActiveCall ||
    hasConfirmHideStory ||
    hasExpandedCaption ||
    hasStoryDetailsModal ||
    hasStoryViewsNRepliesModal ||
    isShowingContextMenu ||
    pauseStory ||
    Boolean(reactionEmoji);

  useEffect(() => {
    if (shouldPauseViewing) {
      spring.pause();
    } else {
      spring.resume();
    }
  }, [shouldPauseViewing, spring]);

  useEffect(() => {
    markStoryRead(messageId);
    log.info('stories.markStoryRead', { messageId });
  }, [markStoryRead, messageId]);

  const navigateStories = useCallback(
    (ev: KeyboardEvent) => {
      if (ev.key === 'ArrowRight') {
        viewStory({
          storyId: story.messageId,
          storyViewMode,
          viewDirection: StoryViewDirectionType.Next,
        });
        ev.preventDefault();
        ev.stopPropagation();
      } else if (ev.key === 'ArrowLeft') {
        viewStory({
          storyId: story.messageId,
          storyViewMode,
          viewDirection: StoryViewDirectionType.Previous,
        });
        ev.preventDefault();
        ev.stopPropagation();
      }
    },
    [story.messageId, storyViewMode, viewStory]
  );

  useEffect(() => {
    document.addEventListener('keydown', navigateStories);

    return () => {
      document.removeEventListener('keydown', navigateStories);
    };
  }, [navigateStories]);

  const groupId = group?.id;
  const isGroupStory = Boolean(groupId);
  useEffect(() => {
    if (!groupId) {
      return;
    }
    loadStoryReplies(groupId, messageId);
  }, [groupId, loadStoryReplies, messageId]);

  const [arrowToShow, setArrowToShow] = useState<Arrow>(Arrow.None);

  useEffect(() => {
    if (arrowToShow === Arrow.None) {
      return;
    }

    let lastMouseMove: number | undefined;

    function updateLastMouseMove() {
      lastMouseMove = Date.now();
    }

    function checkMouseIdle() {
      requestAnimationFrame(() => {
        if (lastMouseMove && Date.now() - lastMouseMove > MOUSE_IDLE_TIME) {
          setArrowToShow(Arrow.None);
        } else {
          checkMouseIdle();
        }
      });
    }
    checkMouseIdle();

    document.addEventListener('mousemove', updateLastMouseMove);

    return () => {
      lastMouseMove = undefined;
      document.removeEventListener('mousemove', updateLastMouseMove);
    };
  }, [arrowToShow]);

  const replies =
    replyState && replyState.messageId === messageId ? replyState.replies : [];
  const views = sendState
    ? sendState.filter(({ status }) => status === SendStatus.Viewed)
    : [];
  const replyCount = replies.length;
  const viewCount = views.length;

  const hasPrevNextArrows = storyViewMode !== StoryViewModeType.Single;

  const canMuteStory = isVideoAttachment(attachment);
  const isStoryMuted = hasAllStoriesMuted || !canMuteStory;

  let muteClassName: string;
  let muteAriaLabel: string;
  if (canMuteStory) {
    muteAriaLabel = hasAllStoriesMuted
      ? i18n('StoryViewer__unmute')
      : i18n('StoryViewer__mute');

    muteClassName = hasAllStoriesMuted
      ? 'StoryViewer__unmute'
      : 'StoryViewer__mute';
  } else {
    muteAriaLabel = i18n('Stories__toast--hasNoSound');
    muteClassName = 'StoryViewer__soundless';
  }

  const contextMenuOptions: ReadonlyArray<ContextMenuOptionType<unknown>> =
    sendState
      ? [
          {
            icon: 'StoryListItem__icon--info',
            label: i18n('StoryListItem__info'),
            onClick: () => setHasStoryDetailsModal(true),
          },
          {
            icon: 'StoryListItem__icon--delete',
            label: i18n('StoryListItem__delete'),
            onClick: () => setConfirmDeleteStory(story),
          },
        ]
      : [
          {
            icon: 'StoryListItem__icon--info',
            label: i18n('StoryListItem__info'),
            onClick: () => setHasStoryDetailsModal(true),
          },
          {
            icon: 'StoryListItem__icon--hide',
            label: isHidden
              ? i18n('StoryListItem__unhide')
              : i18n('StoryListItem__hide'),
            onClick: () => {
              if (isHidden) {
                onHideStory(id);
              } else {
                setHasConfirmHideStory(true);
              }
            },
          },
          {
            icon: 'StoryListItem__icon--chat',
            label: i18n('StoryListItem__go-to-chat'),
            onClick: () => {
              onGoToConversation(id);
            },
          },
        ];

  return (
    <FocusTrap focusTrapOptions={{ allowOutsideClick: true }}>
      <div className="StoryViewer">
        <div
          className="StoryViewer__overlay"
          style={{ background: getStoryBackground(attachment) }}
        />
        <div className="StoryViewer__content">
          {hasPrevNextArrows && (
            <button
              aria-label={i18n('back')}
              className={classNames(
                'StoryViewer__arrow StoryViewer__arrow--left',
                {
                  'StoryViewer__arrow--visible': arrowToShow === Arrow.Left,
                }
              )}
              onClick={() =>
                viewStory({
                  storyId: story.messageId,
                  storyViewMode,
                  viewDirection: StoryViewDirectionType.Previous,
                })
              }
              onMouseMove={() => setArrowToShow(Arrow.Left)}
              type="button"
            />
          )}
          <div className="StoryViewer__protection StoryViewer__protection--top" />
          <div className="StoryViewer__container">
            <StoryImage
              attachment={attachment}
              firstName={firstName || title}
              i18n={i18n}
              isPaused={shouldPauseViewing}
              isMuted={isStoryMuted}
              label={i18n('lightboxImageAlt')}
              moduleClassName="StoryViewer__story"
              queueStoryDownload={queueStoryDownload}
              storyId={messageId}
            >
              {reactionEmoji && (
                <div className="StoryViewer__animated-emojis">
                  <AnimatedEmojiGalore
                    emoji={reactionEmoji}
                    onAnimationEnd={() => {
                      setReactionEmoji(undefined);
                    }}
                  />
                </div>
              )}
            </StoryImage>
            {hasExpandedCaption && (
              <button
                aria-label={i18n('close-popup')}
                className="StoryViewer__caption__overlay"
                onClick={() => setHasExpandedCaption(false)}
                type="button"
              />
            )}
          </div>
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
            <div className="StoryViewer__meta__playback-bar">
              <div>
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
                  isRelativeTime
                  module="StoryViewer__meta--timestamp"
                  timestamp={timestamp}
                />
              </div>
              <div className="StoryViewer__meta__playback-controls">
                <button
                  aria-label={
                    pauseStory
                      ? i18n('StoryViewer__play')
                      : i18n('StoryViewer__pause')
                  }
                  className={
                    pauseStory ? 'StoryViewer__play' : 'StoryViewer__pause'
                  }
                  onClick={() => setPauseStory(!pauseStory)}
                  type="button"
                />
                <button
                  aria-label={muteAriaLabel}
                  className={muteClassName}
                  onClick={
                    canMuteStory
                      ? toggleHasAllStoriesMuted
                      : () => showToast(ToastType.StoryMuted)
                  }
                  type="button"
                />
                <ContextMenu
                  aria-label={i18n('MyStories__more')}
                  i18n={i18n}
                  menuOptions={contextMenuOptions}
                  moduleClassName="StoryViewer__more"
                  onMenuShowingChanged={setIsShowingContextMenu}
                  theme={Theme.Dark}
                />
              </div>
            </div>
            <div className="StoryViewer__progress">
              {Array.from(Array(numStories), (_, index) => (
                <div className="StoryViewer__progress--container" key={index}>
                  {currentIndex === index ? (
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
                        width: currentIndex < index ? '0%' : '100%',
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="StoryViewer__actions">
              {(canReply || sendState) && (
                <button
                  className="StoryViewer__reply"
                  onClick={() => setHasStoryViewsNRepliesModal(true)}
                  tabIndex={0}
                  type="button"
                >
                  <>
                    {sendState || replyCount > 0 ? (
                      <span className="StoryViewer__reply__chevron">
                        {sendState &&
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
                      </span>
                    ) : null}
                    {!sendState && !replyCount && (
                      <span className="StoryViewer__reply__arrow">
                        {isGroupStory
                          ? i18n('StoryViewer__reply-group')
                          : i18n('StoryViewer__reply')}
                      </span>
                    )}
                  </>
                </button>
              )}
            </div>
          </div>
          {hasPrevNextArrows && (
            <button
              aria-label={i18n('forward')}
              className={classNames(
                'StoryViewer__arrow StoryViewer__arrow--right',
                {
                  'StoryViewer__arrow--visible': arrowToShow === Arrow.Right,
                }
              )}
              onClick={() =>
                viewStory({
                  storyId: story.messageId,
                  storyViewMode,
                  viewDirection: StoryViewDirectionType.Next,
                })
              }
              onMouseMove={() => setArrowToShow(Arrow.Right)}
              type="button"
            />
          )}
          <div className="StoryViewer__protection StoryViewer__protection--bottom" />
          <button
            aria-label={i18n('close')}
            className="StoryViewer__close-button"
            onClick={onClose}
            tabIndex={0}
            type="button"
          />
        </div>
        {hasStoryDetailsModal && (
          <StoryDetailsModal
            getPreferredBadge={getPreferredBadge}
            i18n={i18n}
            onClose={() => setHasStoryDetailsModal(false)}
            sender={story.sender}
            sendState={sendState}
            size={attachment?.size}
            timestamp={timestamp}
          />
        )}
        {hasStoryViewsNRepliesModal && (
          <StoryViewsNRepliesModal
            authorTitle={firstName || title}
            canReply={Boolean(canReply)}
            getPreferredBadge={getPreferredBadge}
            i18n={i18n}
            isGroupStory={isGroupStory}
            isMyStory={isMe}
            onClose={() => setHasStoryViewsNRepliesModal(false)}
            onReact={emoji => {
              onReactToStory(emoji, story);
              if (!isGroupStory) {
                setHasStoryViewsNRepliesModal(false);
              }
              setReactionEmoji(emoji);
              showToast(ToastType.StoryReact);
            }}
            onReply={(message, mentions, replyTimestamp) => {
              if (!isGroupStory) {
                setHasStoryViewsNRepliesModal(false);
              }
              onReplyToStory(message, mentions, replyTimestamp, story);
              showToast(ToastType.StoryReply);
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
            views={views}
          />
        )}
        {hasConfirmHideStory && (
          <ConfirmationDialog
            actions={[
              {
                action: () => onHideStory(id),
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
        {confirmDeleteStory && (
          <ConfirmationDialog
            actions={[
              {
                text: i18n('delete'),
                action: () => deleteStoryForEveryone(confirmDeleteStory),
                style: 'negative',
              },
            ]}
            i18n={i18n}
            onClose={() => setConfirmDeleteStory(undefined)}
          >
            {i18n('MyStories__delete')}
          </ConfirmationDialog>
        )}
      </div>
    </FocusTrap>
  );
};
