// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useState } from 'react';
import classNames from 'classnames';
import { usePopper } from 'react-popper';
import type { AttachmentType } from '../types/Attachment';
import type { BodyRangeType, LocalizerType } from '../types/Util';
import type { ContactNameColorType } from '../types/Colors';
import type { ConversationType } from '../state/ducks/conversations';
import type { EmojiPickDataType } from './emoji/EmojiPicker';
import type { InputApi } from './CompositionInput';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges';
import type { RenderEmojiPickerProps } from './conversation/ReactionPicker';
import { Avatar, AvatarSize } from './Avatar';
import { CompositionInput } from './CompositionInput';
import { ContactName } from './conversation/ContactName';
import { EmojiButton } from './emoji/EmojiButton';
import { Emojify } from './conversation/Emojify';
import { MessageBody } from './conversation/MessageBody';
import { MessageTimestamp } from './conversation/MessageTimestamp';
import { Modal } from './Modal';
import { Quote } from './conversation/Quote';
import { ReactionPicker } from './conversation/ReactionPicker';
import { Tabs } from './Tabs';
import { ThemeType } from '../types/Util';
import { getAvatarColor } from '../types/Colors';

type ReplyType = Pick<
  ConversationType,
  | 'acceptedMessageRequest'
  | 'avatarPath'
  | 'color'
  | 'isMe'
  | 'name'
  | 'profileName'
  | 'sharedGroupNames'
  | 'title'
> & {
  body?: string;
  contactNameColor?: ContactNameColorType;
  reactionEmoji?: string;
  timestamp: number;
};

type ViewType = Pick<
  ConversationType,
  | 'acceptedMessageRequest'
  | 'avatarPath'
  | 'color'
  | 'isMe'
  | 'name'
  | 'profileName'
  | 'sharedGroupNames'
  | 'title'
> & {
  contactNameColor?: ContactNameColorType;
  timestamp: number;
};

enum Tab {
  Replies = 'Replies',
  Views = 'Views',
}

export type PropsType = {
  authorTitle: string;
  getPreferredBadge: PreferredBadgeSelectorType;
  i18n: LocalizerType;
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
  views: Array<ViewType>;
};

export const StoryViewsNRepliesModal = ({
  authorTitle,
  getPreferredBadge,
  i18n,
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
}: PropsType): JSX.Element => {
  const inputApiRef = React.useRef<InputApi | undefined>();
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

  let composerElement: JSX.Element | undefined;

  if (!isMyStory) {
    composerElement = (
      <div className="StoryViewsNRepliesModal__compose-container">
        <div className="StoryViewsNRepliesModal__composer">
          {!replies.length && (
            <Quote
              authorTitle={authorTitle}
              conversationColor="steel"
              i18n={i18n}
              isFromMe={false}
              isViewOnce={false}
              rawAttachment={storyPreviewAttachment}
              referencedMessageNotFound={false}
              text={i18n('message--getNotificationText--text-with-emoji', {
                text: i18n('message--getNotificationText--photo'),
                emoji: '📷',
              })}
            />
          )}
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
            onSubmit={onReply}
            onTextTooLong={onTextTooLong}
            placeholder={i18n('StoryViewsNRepliesModal__placeholder')}
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
    );
  }

  const repliesElement = replies.length ? (
    <div className="StoryViewsNRepliesModal__replies">
      {replies.map(reply =>
        reply.reactionEmoji ? (
          <div className="StoryViewsNRepliesModal__reaction">
            <div className="StoryViewsNRepliesModal__reaction--container">
              <Avatar
                acceptedMessageRequest={reply.acceptedMessageRequest}
                avatarPath={reply.avatarPath}
                badge={undefined}
                color={getAvatarColor(reply.color)}
                conversationType="direct"
                i18n={i18n}
                isMe={Boolean(reply.isMe)}
                name={reply.name}
                profileName={reply.profileName}
                sharedGroupNames={reply.sharedGroupNames || []}
                size={AvatarSize.TWENTY_EIGHT}
                title={reply.title}
              />
              <div className="StoryViewsNRepliesModal__reaction--body">
                <div className="StoryViewsNRepliesModal__reply--title">
                  <ContactName
                    contactNameColor={reply.contactNameColor}
                    title={reply.title}
                  />
                </div>
                {i18n('StoryViewsNRepliesModal__reacted')}
                <MessageTimestamp
                  i18n={i18n}
                  module="StoryViewsNRepliesModal__reply--timestamp"
                  timestamp={reply.timestamp}
                />
              </div>
            </div>
            <Emojify text={reply.reactionEmoji} />
          </div>
        ) : (
          <div className="StoryViewsNRepliesModal__reply">
            <Avatar
              acceptedMessageRequest={reply.acceptedMessageRequest}
              avatarPath={reply.avatarPath}
              badge={undefined}
              color={getAvatarColor(reply.color)}
              conversationType="direct"
              i18n={i18n}
              isMe={Boolean(reply.isMe)}
              name={reply.name}
              profileName={reply.profileName}
              sharedGroupNames={reply.sharedGroupNames || []}
              size={AvatarSize.TWENTY_EIGHT}
              title={reply.title}
            />
            <div className="StoryViewsNRepliesModal__message-bubble">
              <div className="StoryViewsNRepliesModal__reply--title">
                <ContactName
                  contactNameColor={reply.contactNameColor}
                  title={reply.title}
                />
              </div>

              <MessageBody i18n={i18n} text={String(reply.body)} />

              <MessageTimestamp
                i18n={i18n}
                module="StoryViewsNRepliesModal__reply--timestamp"
                timestamp={reply.timestamp}
              />
            </div>
          </div>
        )
      )}
    </div>
  ) : undefined;

  const viewsElement = views.length ? (
    <div className="StoryViewsNRepliesModal__views">
      {views.map(view => (
        <div className="StoryViewsNRepliesModal__view" key={view.timestamp}>
          <div>
            <Avatar
              acceptedMessageRequest={view.acceptedMessageRequest}
              avatarPath={view.avatarPath}
              badge={undefined}
              color={getAvatarColor(view.color)}
              conversationType="direct"
              i18n={i18n}
              isMe={Boolean(view.isMe)}
              name={view.name}
              profileName={view.profileName}
              sharedGroupNames={view.sharedGroupNames || []}
              size={AvatarSize.TWENTY_EIGHT}
              title={view.title}
            />
            <span className="StoryViewsNRepliesModal__view--name">
              <ContactName
                contactNameColor={view.contactNameColor}
                title={view.title}
              />
            </span>
          </div>
          <MessageTimestamp
            i18n={i18n}
            module="StoryViewsNRepliesModal__view--timestamp"
            timestamp={view.timestamp}
          />
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

  const hasOnlyViewsElement =
    viewsElement && !repliesElement && !composerElement;

  return (
    <Modal
      i18n={i18n}
      moduleClassName={classNames('StoryViewsNRepliesModal', {
        'StoryViewsNRepliesModal--group': Boolean(
          views.length && replies.length
        ),
      })}
      onClose={onClose}
      useFocusTrap={!hasOnlyViewsElement}
    >
      {tabsElement || (
        <>
          {viewsElement}
          {repliesElement}
          {composerElement}
        </>
      )}
    </Modal>
  );
};
