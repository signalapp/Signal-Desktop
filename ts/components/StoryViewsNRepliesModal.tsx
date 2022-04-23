// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import type { ReplyType } from '../types/Stories';
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
import { Theme } from '../util/theme';
import { ThemeType } from '../types/Util';
import { getAvatarColor } from '../types/Colors';

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
  views: Array<ViewType>;
};

export const StoryViewsNRepliesModal = ({
  authorTitle,
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
}: PropsType): JSX.Element => {
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

  if (!isMyStory) {
    composerElement = (
      <div className="StoryViewsNRepliesModal__compose-container">
        <div className="StoryViewsNRepliesModal__composer">
          {!isGroupStory && (
            <Quote
              authorTitle={authorTitle}
              conversationColor="ultramarine"
              i18n={i18n}
              isFromMe={false}
              isViewOnce={false}
              moduleClassName="StoryViewsNRepliesModal__quote"
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
            onSubmit={(...args) => {
              inputApiRef.current?.reset();
              onReply(...args);
            }}
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

  let repliesElement: JSX.Element | undefined;

  if (replies.length) {
    repliesElement = (
      <div className="StoryViewsNRepliesModal__replies">
        {replies.map(reply =>
          reply.reactionEmoji ? (
            <div className="StoryViewsNRepliesModal__reaction" key={reply.id}>
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
            <div className="StoryViewsNRepliesModal__reply" key={reply.id}>
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
              <div
                className={classNames(
                  'StoryViewsNRepliesModal__message-bubble',
                  {
                    'StoryViewsNRepliesModal__message-bubble--doe': Boolean(
                      reply.deletedForEveryone
                    ),
                  }
                )}
              >
                <div className="StoryViewsNRepliesModal__reply--title">
                  <ContactName
                    contactNameColor={reply.contactNameColor}
                    title={reply.title}
                  />
                </div>

                <MessageBody
                  i18n={i18n}
                  text={
                    reply.deletedForEveryone
                      ? i18n('message--deletedForEveryone')
                      : String(reply.body)
                  }
                />

                <MessageTimestamp
                  i18n={i18n}
                  module="StoryViewsNRepliesModal__reply--timestamp"
                  timestamp={reply.timestamp}
                />
              </div>
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
