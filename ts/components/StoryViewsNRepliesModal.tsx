// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import { usePopper } from 'react-popper';
import type { AttachmentType } from '../types/Attachment';
import type { BodyRangeType, LocalizerType } from '../types/Util';
import type { EmojiPickDataType } from './emoji/EmojiPicker';
import type { InputApi } from './CompositionInput';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges';
import type { RenderEmojiPickerProps } from './conversation/ReactionPicker';
import type { ReplyType, StorySendStateType } from '../types/Stories';
import { Avatar, AvatarSize } from './Avatar';
import { CompositionInput } from './CompositionInput';
import { ContactName } from './conversation/ContactName';
import { EmojiButton } from './emoji/EmojiButton';
import { Emojify } from './conversation/Emojify';
import { Message, TextDirection } from './conversation/Message';
import { MessageTimestamp } from './conversation/MessageTimestamp';
import { Modal } from './Modal';
import { Quote } from './conversation/Quote';
import { ReactionPicker } from './conversation/ReactionPicker';
import { Tabs } from './Tabs';
import { Theme } from '../util/theme';
import { ThemeType } from '../types/Util';
import { WidthBreakpoint } from './_util';
import { getAvatarColor } from '../types/Colors';
import { getStoryReplyText } from '../util/getStoryReplyText';
import { shouldNeverBeCalled } from '../util/shouldNeverBeCalled';

// Menu is disabled so these actions are inaccessible. We also don't support
// link previews, tap to view messages, attachments, or gifts. Just regular
// text messages and reactions.
const MESSAGE_DEFAULT_PROPS = {
  canDeleteForEveryone: false,
  canDownload: false,
  canReact: false,
  canReply: false,
  canRetry: false,
  canRetryDeleteForEveryone: false,
  checkForAccount: shouldNeverBeCalled,
  clearSelectedMessage: shouldNeverBeCalled,
  containerWidthBreakpoint: WidthBreakpoint.Medium,
  deleteMessage: shouldNeverBeCalled,
  deleteMessageForEveryone: shouldNeverBeCalled,
  displayTapToViewMessage: shouldNeverBeCalled,
  doubleCheckMissingQuoteReference: shouldNeverBeCalled,
  downloadAttachment: shouldNeverBeCalled,
  isBlocked: false,
  isMessageRequestAccepted: true,
  kickOffAttachmentDownload: shouldNeverBeCalled,
  markAttachmentAsCorrupted: shouldNeverBeCalled,
  markViewed: shouldNeverBeCalled,
  messageExpanded: shouldNeverBeCalled,
  openConversation: shouldNeverBeCalled,
  openGiftBadge: shouldNeverBeCalled,
  openLink: shouldNeverBeCalled,
  previews: [],
  reactToMessage: shouldNeverBeCalled,
  renderAudioAttachment: () => <div />,
  renderEmojiPicker: () => <div />,
  renderReactionPicker: () => <div />,
  replyToMessage: shouldNeverBeCalled,
  retryDeleteForEveryone: shouldNeverBeCalled,
  retrySend: shouldNeverBeCalled,
  scrollToQuotedMessage: shouldNeverBeCalled,
  showContactDetail: shouldNeverBeCalled,
  showContactModal: shouldNeverBeCalled,
  showExpiredIncomingTapToViewToast: shouldNeverBeCalled,
  showExpiredOutgoingTapToViewToast: shouldNeverBeCalled,
  showForwardMessageModal: shouldNeverBeCalled,
  showMessageDetail: shouldNeverBeCalled,
  showVisualAttachment: shouldNeverBeCalled,
  startConversation: shouldNeverBeCalled,
  theme: ThemeType.dark,
  viewStory: shouldNeverBeCalled,
};

enum Tab {
  Replies = 'Replies',
  Views = 'Views',
}

export type PropsType = {
  authorTitle: string;
  canReply: boolean;
  getPreferredBadge: PreferredBadgeSelectorType;
  i18n: LocalizerType;
  isGroupStory?: boolean;
  isMyStory?: boolean;
  onClose: () => unknown;
  onReact: (emoji: string) => unknown;
  onReply: (
    message: string,
    mentions: Array<BodyRangeType>,
    timestamp: number
  ) => unknown;
  onSetSkinTone: (tone: number) => unknown;
  onTextTooLong: () => unknown;
  onUseEmoji: (_: EmojiPickDataType) => unknown;
  preferredReactionEmoji: Array<string>;
  recentEmojis?: Array<string>;
  renderEmojiPicker: (props: RenderEmojiPickerProps) => JSX.Element;
  replies: Array<ReplyType>;
  skinTone?: number;
  storyPreviewAttachment?: AttachmentType;
  views: Array<StorySendStateType>;
};

export const StoryViewsNRepliesModal = ({
  authorTitle,
  canReply,
  getPreferredBadge,
  i18n,
  isGroupStory,
  isMyStory,
  onClose,
  onReact,
  onReply,
  onSetSkinTone,
  onTextTooLong,
  onUseEmoji,
  preferredReactionEmoji,
  recentEmojis,
  renderEmojiPicker,
  replies,
  skinTone,
  storyPreviewAttachment,
  views,
}: PropsType): JSX.Element | null => {
  const containerElementRef = useRef<HTMLDivElement | null>(null);
  const inputApiRef = useRef<InputApi | undefined>();
  const [bottom, setBottom] = useState<HTMLDivElement | null>(null);
  const [messageBodyText, setMessageBodyText] = useState('');
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  const focusComposer = useCallback(() => {
    if (inputApiRef.current) {
      inputApiRef.current.focus();
    }
  }, [inputApiRef]);

  const insertEmoji = useCallback(
    (e: EmojiPickDataType) => {
      if (inputApiRef.current) {
        inputApiRef.current.insertEmoji(e);
        onUseEmoji(e);
      }
    },
    [inputApiRef, onUseEmoji]
  );

  const [referenceElement, setReferenceElement] =
    useState<HTMLButtonElement | null>(null);
  const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(
    null
  );

  const { styles, attributes } = usePopper(referenceElement, popperElement, {
    placement: 'top-start',
    strategy: 'fixed',
  });

  useEffect(() => {
    if (replies.length) {
      bottom?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [bottom, replies.length]);

  let composerElement: JSX.Element | undefined;

  if (!isMyStory && canReply) {
    composerElement = (
      <>
        {!isGroupStory && (
          <Quote
            authorTitle={authorTitle}
            conversationColor="ultramarine"
            i18n={i18n}
            isFromMe={false}
            isGiftBadge={false}
            isStoryReply
            isViewOnce={false}
            moduleClassName="StoryViewsNRepliesModal__quote"
            rawAttachment={storyPreviewAttachment}
            referencedMessageNotFound={false}
            text={getStoryReplyText(i18n, storyPreviewAttachment)}
          />
        )}
        <div className="StoryViewsNRepliesModal__compose-container">
          <div className="StoryViewsNRepliesModal__composer">
            <CompositionInput
              draftText={messageBodyText}
              getPreferredBadge={getPreferredBadge}
              i18n={i18n}
              inputApi={inputApiRef}
              moduleClassName="StoryViewsNRepliesModal__input"
              onEditorStateChange={messageText => {
                setMessageBodyText(messageText);
              }}
              onPickEmoji={insertEmoji}
              onSubmit={(...args) => {
                inputApiRef.current?.reset();
                onReply(...args);
              }}
              onTextTooLong={onTextTooLong}
              placeholder={
                isGroupStory
                  ? i18n('StoryViewer__reply-group')
                  : i18n('StoryViewer__reply')
              }
              theme={ThemeType.dark}
            >
              <EmojiButton
                className="StoryViewsNRepliesModal__emoji-button"
                i18n={i18n}
                onPickEmoji={insertEmoji}
                onClose={focusComposer}
                recentEmojis={recentEmojis}
                skinTone={skinTone}
                onSetSkinTone={onSetSkinTone}
              />
            </CompositionInput>
          </div>
          <button
            aria-label={i18n('StoryViewsNRepliesModal__react')}
            className="StoryViewsNRepliesModal__react"
            onClick={() => {
              setShowReactionPicker(!showReactionPicker);
            }}
            ref={setReferenceElement}
            type="button"
          />
          {showReactionPicker && (
            <div
              ref={setPopperElement}
              style={styles.popper}
              {...attributes.popper}
            >
              <ReactionPicker
                i18n={i18n}
                onClose={() => {
                  setShowReactionPicker(false);
                }}
                onPick={emoji => {
                  setShowReactionPicker(false);
                  onReact(emoji);
                }}
                onSetSkinTone={onSetSkinTone}
                preferredReactionEmoji={preferredReactionEmoji}
                renderEmojiPicker={renderEmojiPicker}
              />
            </div>
          )}
        </div>
      </>
    );
  }

  let repliesElement: JSX.Element | undefined;

  if (replies.length) {
    repliesElement = (
      <div
        className="StoryViewsNRepliesModal__replies"
        ref={containerElementRef}
      >
        {replies.map((reply, index) =>
          reply.reactionEmoji ? (
            <div className="StoryViewsNRepliesModal__reaction" key={reply.id}>
              <div className="StoryViewsNRepliesModal__reaction--container">
                <Avatar
                  acceptedMessageRequest={reply.author.acceptedMessageRequest}
                  avatarPath={reply.author.avatarPath}
                  badge={getPreferredBadge(reply.author.badges)}
                  color={getAvatarColor(reply.author.color)}
                  conversationType="direct"
                  i18n={i18n}
                  isMe={Boolean(reply.author.isMe)}
                  name={reply.author.name}
                  profileName={reply.author.profileName}
                  sharedGroupNames={reply.author.sharedGroupNames || []}
                  size={AvatarSize.TWENTY_EIGHT}
                  theme={ThemeType.dark}
                  title={reply.author.title}
                />
                <div className="StoryViewsNRepliesModal__reaction--body">
                  <div className="StoryViewsNRepliesModal__reply--title">
                    <ContactName
                      contactNameColor={reply.contactNameColor}
                      title={reply.author.title}
                    />
                  </div>
                  {i18n('StoryViewsNRepliesModal__reacted')}
                  <MessageTimestamp
                    i18n={i18n}
                    isRelativeTime
                    module="StoryViewsNRepliesModal__reply--timestamp"
                    timestamp={reply.timestamp}
                  />
                </div>
              </div>
              <Emojify text={reply.reactionEmoji} />
            </div>
          ) : (
            <div key={reply.id}>
              <Message
                {...MESSAGE_DEFAULT_PROPS}
                author={reply.author}
                containerElementRef={containerElementRef}
                conversationColor="ultramarine"
                conversationId={reply.conversationId}
                conversationTitle={reply.author.title}
                conversationType="group"
                direction="incoming"
                disableMenu
                getPreferredBadge={getPreferredBadge}
                i18n={i18n}
                id={reply.id}
                interactionMode="mouse"
                readStatus={reply.readStatus}
                renderingContext="StoryViewsNRepliesModal"
                shouldCollapseAbove={
                  reply.conversationId === replies[index - 1]?.conversationId
                }
                shouldCollapseBelow={
                  reply.conversationId === replies[index + 1]?.conversationId
                }
                shouldHideMetadata={false}
                text={reply.body}
                textDirection={TextDirection.Default}
                timestamp={reply.timestamp}
              />
            </div>
          )
        )}
        <div ref={setBottom} />
      </div>
    );
  } else if (isGroupStory) {
    repliesElement = (
      <div className="StoryViewsNRepliesModal__replies--none">
        {i18n('StoryViewsNRepliesModal__no-replies')}
      </div>
    );
  }

  const viewsElement = views.length ? (
    <div className="StoryViewsNRepliesModal__views">
      {views.map(view => (
        <div className="StoryViewsNRepliesModal__view" key={view.recipient.id}>
          <div>
            <Avatar
              acceptedMessageRequest={view.recipient.acceptedMessageRequest}
              avatarPath={view.recipient.avatarPath}
              badge={undefined}
              color={getAvatarColor(view.recipient.color)}
              conversationType="direct"
              i18n={i18n}
              isMe={Boolean(view.recipient.isMe)}
              name={view.recipient.name}
              profileName={view.recipient.profileName}
              sharedGroupNames={view.recipient.sharedGroupNames || []}
              size={AvatarSize.TWENTY_EIGHT}
              title={view.recipient.title}
            />
            <span className="StoryViewsNRepliesModal__view--name">
              <ContactName title={view.recipient.title} />
            </span>
          </div>
          {view.updatedAt && (
            <MessageTimestamp
              i18n={i18n}
              module="StoryViewsNRepliesModal__view--timestamp"
              timestamp={view.updatedAt}
            />
          )}
        </div>
      ))}
    </div>
  ) : undefined;

  const tabsElement =
    views.length && replies.length ? (
      <Tabs
        initialSelectedTab={Tab.Views}
        moduleClassName="StoryViewsNRepliesModal__tabs"
        tabs={[
          {
            id: Tab.Views,
            label: i18n('StoryViewsNRepliesModal__tab--views'),
          },
          {
            id: Tab.Replies,
            label: i18n('StoryViewsNRepliesModal__tab--replies'),
          },
        ]}
      >
        {({ selectedTab }) => (
          <>
            {selectedTab === Tab.Views && viewsElement}
            {selectedTab === Tab.Replies && (
              <>
                {repliesElement}
                {composerElement}
              </>
            )}
          </>
        )}
      </Tabs>
    ) : undefined;

  if (!tabsElement && !viewsElement && !repliesElement && !composerElement) {
    return null;
  }

  return (
    <Modal
      i18n={i18n}
      moduleClassName="StoryViewsNRepliesModal"
      onClose={onClose}
      useFocusTrap={Boolean(composerElement)}
      theme={Theme.Dark}
    >
      <div
        className={classNames({
          'StoryViewsNRepliesModal--group': Boolean(isGroupStory),
        })}
      >
        {tabsElement || (
          <>
            {viewsElement || repliesElement}
            {composerElement}
          </>
        )}
      </div>
    </Modal>
  );
};
