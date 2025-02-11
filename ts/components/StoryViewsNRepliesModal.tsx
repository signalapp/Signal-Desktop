// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import classNames from 'classnames';
import { noop, orderBy } from 'lodash';

import type { DraftBodyRanges } from '../types/BodyRange';
import type { LocalizerType } from '../types/Util';
import type { ConversationType } from '../state/ducks/conversations';
import type { EmojiPickDataType } from './emoji/EmojiPicker';
import type { InputApi } from './CompositionInput';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges';
import type { RenderEmojiPickerProps } from './conversation/ReactionPicker';
import type { ReplyType, StorySendStateType } from '../types/Stories';
import { StoryViewTargetType } from '../types/Stories';
import { Avatar, AvatarSize } from './Avatar';
import { CompositionInput } from './CompositionInput';
import { ContactName } from './conversation/ContactName';
import { EmojiButton } from './emoji/EmojiButton';
import { Emojify } from './conversation/Emojify';
import { Message, TextDirection } from './conversation/Message';
import { MessageTimestamp } from './conversation/MessageTimestamp';
import { Modal } from './Modal';
import { ReactionPicker } from './conversation/ReactionPicker';
import { Tabs } from './Tabs';
import { Theme } from '../util/theme';
import { ThemeType } from '../types/Util';
import { WidthBreakpoint } from './_util';
import { getAvatarColor } from '../types/Colors';
import { shouldNeverBeCalled } from '../util/shouldNeverBeCalled';
import { ContextMenu } from './ContextMenu';
import { ConfirmationDialog } from './ConfirmationDialog';

// Menu is disabled so these actions are inaccessible. We also don't support
// link previews, tap to view messages, attachments, or gifts. Just regular
// text messages and reactions.
const MESSAGE_DEFAULT_PROPS = {
  canDeleteForEveryone: false,
  checkForAccount: shouldNeverBeCalled,
  clearTargetedMessage: shouldNeverBeCalled,
  containerWidthBreakpoint: WidthBreakpoint.Medium,
  doubleCheckMissingQuoteReference: shouldNeverBeCalled,
  isBlocked: false,
  isMessageRequestAccepted: true,
  isSelected: false,
  isSelectMode: false,
  isSMS: false,
  onToggleSelect: shouldNeverBeCalled,
  onReplyToMessage: shouldNeverBeCalled,
  kickOffAttachmentDownload: shouldNeverBeCalled,
  cancelAttachmentDownload: shouldNeverBeCalled,
  markAttachmentAsCorrupted: shouldNeverBeCalled,
  messageExpanded: shouldNeverBeCalled,
  openGiftBadge: shouldNeverBeCalled,
  openLink: shouldNeverBeCalled,
  previews: [],
  retryMessageSend: shouldNeverBeCalled,
  pushPanelForConversation: shouldNeverBeCalled,
  renderAudioAttachment: () => <div />,
  saveAttachment: shouldNeverBeCalled,
  saveAttachments: shouldNeverBeCalled,
  scrollToQuotedMessage: shouldNeverBeCalled,
  showConversation: noop,
  showAttachmentDownloadStillInProgressToast: shouldNeverBeCalled,
  showAttachmentNotAvailableModal: shouldNeverBeCalled,
  showExpiredIncomingTapToViewToast: shouldNeverBeCalled,
  showExpiredOutgoingTapToViewToast: shouldNeverBeCalled,
  showLightbox: shouldNeverBeCalled,
  showLightboxForViewOnceMedia: shouldNeverBeCalled,
  showMediaNoLongerAvailableToast: shouldNeverBeCalled,
  startConversation: shouldNeverBeCalled,
  theme: ThemeType.dark,
  viewStory: shouldNeverBeCalled,
};

export enum StoryViewsNRepliesTab {
  Replies = 'Replies',
  Views = 'Views',
}

export type PropsType = {
  authorTitle: string;
  canReply: boolean;
  deleteGroupStoryReply: (id: string) => void;
  deleteGroupStoryReplyForEveryone: (id: string) => void;
  getPreferredBadge: PreferredBadgeSelectorType;
  group: Pick<ConversationType, 'left'> | undefined;
  hasViewReceiptSetting: boolean;
  hasViewsCapability: boolean;
  i18n: LocalizerType;
  platform: string;
  isFormattingEnabled: boolean;
  isInternalUser?: boolean;
  onChangeViewTarget: (target: StoryViewTargetType) => unknown;
  onClose: () => unknown;
  onReact: (emoji: string) => unknown;
  onReply: (
    message: string,
    bodyRanges: DraftBodyRanges,
    timestamp: number
  ) => unknown;
  onSetSkinTone: (tone: number) => unknown;
  onTextTooLong: () => unknown;
  onUseEmoji: (_: EmojiPickDataType) => unknown;
  ourConversationId: string | undefined;
  preferredReactionEmoji: ReadonlyArray<string>;
  recentEmojis?: ReadonlyArray<string>;
  renderEmojiPicker: (props: RenderEmojiPickerProps) => JSX.Element;
  replies: ReadonlyArray<ReplyType>;
  showContactModal: (contactId: string, conversationId?: string) => void;
  skinTone?: number;
  sortedGroupMembers?: ReadonlyArray<ConversationType>;
  views: ReadonlyArray<StorySendStateType>;
  viewTarget: StoryViewTargetType;
};

export function StoryViewsNRepliesModal({
  authorTitle,
  canReply,
  deleteGroupStoryReply,
  deleteGroupStoryReplyForEveryone,
  getPreferredBadge,
  group,
  hasViewReceiptSetting,
  hasViewsCapability,
  i18n,
  platform,
  isFormattingEnabled,
  isInternalUser,
  onChangeViewTarget,
  onClose,
  onReact,
  onReply,
  onSetSkinTone,
  onTextTooLong,
  onUseEmoji,
  ourConversationId,
  preferredReactionEmoji,
  recentEmojis,
  renderEmojiPicker,
  replies,
  showContactModal,
  skinTone,
  sortedGroupMembers,
  viewTarget,
  views,
}: PropsType): JSX.Element | null {
  const [deleteReplyId, setDeleteReplyId] = useState<string | undefined>(
    undefined
  );
  const [deleteForEveryoneReplyId, setDeleteForEveryoneReplyId] = useState<
    string | undefined
  >(undefined);

  // These states aren't in redux; they are meant to last only as long as this dialog.
  const [revealedSpoilersById, setRevealedSpoilersById] = useState<
    Record<string, Record<number, boolean> | undefined>
  >({});
  const [displayLimitById, setDisplayLimitById] = useState<
    Record<string, number | undefined>
  >({});

  const containerElementRef = useRef<HTMLDivElement | null>(null);
  const inputApiRef = useRef<InputApi | undefined>();
  const shouldScrollToBottomRef = useRef(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [messageBodyText, setMessageBodyText] = useState('');

  const currentTab = useMemo<StoryViewsNRepliesTab>(() => {
    return viewTarget === StoryViewTargetType.Replies
      ? StoryViewsNRepliesTab.Replies
      : StoryViewsNRepliesTab.Views;
  }, [viewTarget]);

  const sortedViews = useMemo(() => {
    return orderBy(views, 'updatedAt', 'desc');
  }, [views]);

  const onTabChange = (tab: string) => {
    onChangeViewTarget(
      tab === StoryViewsNRepliesTab.Replies
        ? StoryViewTargetType.Replies
        : StoryViewTargetType.Views
    );
  };

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

  let composerElement: JSX.Element | undefined;

  useLayoutEffect(() => {
    if (
      currentTab === StoryViewsNRepliesTab.Replies &&
      replies.length &&
      shouldScrollToBottomRef.current
    ) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      shouldScrollToBottomRef.current = false;
    }
  }, [currentTab, replies.length]);

  if (group && group.left) {
    composerElement = (
      <div className="StoryViewsNRepliesModal__not-a-member">
        {i18n('icu:StoryViewsNRepliesModal__not-a-member')}
      </div>
    );
  } else if (canReply) {
    composerElement = (
      <>
        <ReactionPicker
          i18n={i18n}
          onPick={emoji => {
            if (!group) {
              onClose();
            }
            onReact(emoji);
          }}
          onSetSkinTone={onSetSkinTone}
          preferredReactionEmoji={preferredReactionEmoji}
          renderEmojiPicker={renderEmojiPicker}
        />
        <div className="StoryViewsNRepliesModal__compose-container">
          <div className="StoryViewsNRepliesModal__composer">
            <CompositionInput
              draftText={messageBodyText}
              getPreferredBadge={getPreferredBadge}
              i18n={i18n}
              inputApi={inputApiRef}
              isActive
              isFormattingEnabled={isFormattingEnabled}
              moduleClassName="StoryViewsNRepliesModal__input"
              onCloseLinkPreview={noop}
              onEditorStateChange={({ messageText }) => {
                setMessageBodyText(messageText);
              }}
              onPickEmoji={onUseEmoji}
              onSubmit={(...args) => {
                inputApiRef.current?.reset();
                shouldScrollToBottomRef.current = true;
                onReply(...args);
              }}
              onTextTooLong={onTextTooLong}
              ourConversationId={ourConversationId}
              placeholder={
                group
                  ? i18n('icu:StoryViewer__reply-group')
                  : i18n('icu:StoryViewer__reply-placeholder', {
                      firstName: authorTitle,
                    })
              }
              platform={platform}
              quotedMessageId={null}
              sendCounter={0}
              skinTone={skinTone ?? null}
              sortedGroupMembers={sortedGroupMembers ?? null}
              theme={ThemeType.dark}
              conversationId={null}
              draftBodyRanges={null}
              draftEditMessage={null}
              large={null}
              shouldHidePopovers={null}
              linkPreviewResult={null}
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
        </div>
      </>
    );
  }

  let repliesElement: JSX.Element | undefined;

  function shouldCollapse(reply: ReplyType, otherReply?: ReplyType) {
    // deleted reactions get rendered the same as deleted replies
    return (
      reply.conversationId === otherReply?.conversationId &&
      (!otherReply?.reactionEmoji || Boolean(otherReply.deletedForEveryone))
    );
  }

  if (replies.length) {
    repliesElement = (
      <div
        className="StoryViewsNRepliesModal__replies"
        ref={containerElementRef}
      >
        {replies.map((reply, index) => {
          return (
            <ReplyOrReactionMessage
              key={reply.id}
              containerElementRef={containerElementRef}
              deleteGroupStoryReply={() => setDeleteReplyId(reply.id)}
              deleteGroupStoryReplyForEveryone={() =>
                setDeleteForEveryoneReplyId(reply.id)
              }
              displayLimit={displayLimitById[reply.id]}
              getPreferredBadge={getPreferredBadge}
              i18n={i18n}
              platform={platform}
              id={reply.id}
              isInternalUser={isInternalUser}
              isSpoilerExpanded={revealedSpoilersById[reply.id] || {}}
              messageExpanded={(messageId, displayLimit) => {
                const update = {
                  ...displayLimitById,
                  [messageId]: displayLimit,
                };
                setDisplayLimitById(update);
              }}
              reply={reply}
              shouldCollapseAbove={shouldCollapse(reply, replies[index - 1])}
              shouldCollapseBelow={shouldCollapse(reply, replies[index + 1])}
              showContactModal={showContactModal}
              showSpoiler={(messageId, data) => {
                const update = {
                  ...revealedSpoilersById,
                  [messageId]: data,
                };
                setRevealedSpoilersById(update);
              }}
            />
          );
        })}
        <div ref={bottomRef} />
      </div>
    );
  } else if (group) {
    repliesElement = (
      <div className="StoryViewsNRepliesModal__replies--none">
        {i18n('icu:StoryViewsNRepliesModal__no-replies')}
      </div>
    );
  }

  let viewsElement: JSX.Element | undefined;
  if (hasViewsCapability && !hasViewReceiptSetting) {
    viewsElement = (
      <div className="StoryViewsNRepliesModal__read-receipts-off">
        {i18n('icu:StoryViewsNRepliesModal__read-receipts-off')}
      </div>
    );
  } else if (sortedViews.length) {
    viewsElement = (
      <div className="StoryViewsNRepliesModal__views">
        {sortedViews.map(view => (
          <div
            className="StoryViewsNRepliesModal__view"
            key={view.recipient.id}
          >
            <div>
              <Avatar
                acceptedMessageRequest={view.recipient.acceptedMessageRequest}
                avatarUrl={view.recipient.avatarUrl}
                badge={undefined}
                color={getAvatarColor(view.recipient.color)}
                conversationType="direct"
                i18n={i18n}
                isMe={Boolean(view.recipient.isMe)}
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
    );
  } else if (hasViewsCapability) {
    viewsElement = (
      <div className="StoryViewsNRepliesModal__replies--none">
        {i18n('icu:StoryViewsNRepliesModal__no-views')}
      </div>
    );
  }

  const tabsElement =
    viewsElement && repliesElement ? (
      <Tabs
        selectedTab={currentTab}
        onTabChange={onTabChange}
        moduleClassName="StoryViewsNRepliesModal__tabs"
        tabs={[
          {
            id: StoryViewsNRepliesTab.Views,
            label: i18n('icu:StoryViewsNRepliesModal__tab--views'),
          },
          {
            id: StoryViewsNRepliesTab.Replies,
            label: i18n('icu:StoryViewsNRepliesModal__tab--replies'),
          },
        ]}
      >
        {({ selectedTab }) => (
          <>
            {selectedTab === StoryViewsNRepliesTab.Views && viewsElement}
            {selectedTab === StoryViewsNRepliesTab.Replies && (
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
    <>
      <Modal
        modalName="StoryViewsNRepliesModal"
        i18n={i18n}
        moduleClassName={classNames({
          StoryViewsNRepliesModal: true,
          'StoryViewsNRepliesModal--group': Boolean(group),
        })}
        onClose={onClose}
        padded={false}
        useFocusTrap={Boolean(composerElement)}
        theme={Theme.Dark}
      >
        <div className="StoryViewsNRepliesModal__content">
          {tabsElement || (
            <>
              {viewsElement || repliesElement}
              {composerElement}
            </>
          )}
        </div>
      </Modal>
      {deleteReplyId && (
        <ConfirmationDialog
          i18n={i18n}
          theme={Theme.Dark}
          dialogName="confirmDialog"
          actions={[
            {
              text: i18n('icu:delete'),
              action: () => deleteGroupStoryReply(deleteReplyId),
              style: 'negative',
            },
          ]}
          title={i18n('icu:deleteWarning')}
          onClose={() => setDeleteReplyId(undefined)}
          onCancel={() => setDeleteReplyId(undefined)}
        />
      )}
      {deleteForEveryoneReplyId && (
        <ConfirmationDialog
          i18n={i18n}
          theme={Theme.Dark}
          dialogName="confirmDialog"
          actions={[
            {
              text: i18n('icu:delete'),
              action: () =>
                deleteGroupStoryReplyForEveryone(deleteForEveryoneReplyId),
              style: 'negative',
            },
          ]}
          title={i18n('icu:deleteWarning')}
          onClose={() => setDeleteForEveryoneReplyId(undefined)}
          onCancel={() => setDeleteForEveryoneReplyId(undefined)}
        >
          {i18n('icu:deleteForEveryoneWarning')}
        </ConfirmationDialog>
      )}
    </>
  );
}

type ReplyOrReactionMessageProps = {
  containerElementRef: React.RefObject<HTMLElement>;
  deleteGroupStoryReply: (replyId: string) => void;
  deleteGroupStoryReplyForEveryone: (replyId: string) => void;
  displayLimit: number | undefined;
  getPreferredBadge: PreferredBadgeSelectorType;
  i18n: LocalizerType;
  platform: string;
  id: string;
  isInternalUser?: boolean;
  isSpoilerExpanded: Record<number, boolean>;
  onContextMenu?: (ev: React.MouseEvent) => void;
  reply: ReplyType;
  shouldCollapseAbove: boolean;
  shouldCollapseBelow: boolean;
  showContactModal: (contactId: string, conversationId?: string) => void;
  messageExpanded: (messageId: string, displayLimit: number) => void;
  showSpoiler: (messageId: string, data: Record<number, boolean>) => void;
};

function ReplyOrReactionMessage({
  containerElementRef,
  deleteGroupStoryReply,
  deleteGroupStoryReplyForEveryone,
  displayLimit,
  getPreferredBadge,
  i18n,
  id,
  isInternalUser,
  isSpoilerExpanded,
  messageExpanded,
  platform,
  reply,
  shouldCollapseAbove,
  shouldCollapseBelow,
  showContactModal,
  showSpoiler,
}: ReplyOrReactionMessageProps) {
  const renderContent = (onContextMenu?: (ev: React.MouseEvent) => void) => {
    if (reply.reactionEmoji && !reply.deletedForEveryone) {
      return (
        <div
          className="StoryViewsNRepliesModal__reaction"
          onContextMenu={onContextMenu}
          data-id={id}
        >
          <div className="StoryViewsNRepliesModal__reaction--container">
            <Avatar
              acceptedMessageRequest={reply.author.acceptedMessageRequest}
              avatarUrl={reply.author.avatarUrl}
              badge={getPreferredBadge(reply.author.badges)}
              color={getAvatarColor(reply.author.color)}
              conversationType="direct"
              i18n={i18n}
              isMe={Boolean(reply.author.isMe)}
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
                  title={
                    reply.author.isMe ? i18n('icu:you') : reply.author.title
                  }
                />
              </div>
              {reply.author.isMe
                ? i18n('icu:StoryViewsNRepliesModal__reacted--you')
                : i18n('icu:StoryViewsNRepliesModal__reacted--someone-else')}
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
      );
    }

    return (
      <div className="StoryViewsNRepliesModal__reply" data-id={id}>
        <Message
          {...MESSAGE_DEFAULT_PROPS}
          author={reply.author}
          bodyRanges={reply.bodyRanges}
          contactNameColor={reply.contactNameColor}
          containerElementRef={containerElementRef}
          conversationColor="ultramarine"
          conversationId={reply.conversationId}
          conversationTitle={reply.author.title}
          conversationType="group"
          deletedForEveryone={reply.deletedForEveryone}
          direction="incoming"
          displayLimit={displayLimit}
          getPreferredBadge={getPreferredBadge}
          i18n={i18n}
          platform={platform}
          id={reply.id}
          interactionMode="mouse"
          isSpoilerExpanded={isSpoilerExpanded}
          messageExpanded={messageExpanded}
          onContextMenu={onContextMenu}
          readStatus={reply.readStatus}
          renderingContext="StoryViewsNRepliesModal"
          renderMenu={undefined}
          shouldCollapseAbove={shouldCollapseAbove}
          shouldCollapseBelow={shouldCollapseBelow}
          shouldHideMetadata={false}
          showContactModal={showContactModal}
          showSpoiler={showSpoiler}
          text={reply.body}
          textDirection={TextDirection.Default}
          timestamp={reply.timestamp}
        />
      </div>
    );
  };

  const menuOptions = [
    {
      icon: 'module-message__context--icon module-message__context__delete-message',
      label: i18n('icu:StoryViewsNRepliesModal__delete-reply'),
      onClick: () => deleteGroupStoryReply(reply.id),
    },
    {
      icon: 'module-message__context--icon module-message__context__delete-message-for-everyone',
      label: i18n('icu:StoryViewsNRepliesModal__delete-reply-for-everyone'),
      onClick: () => deleteGroupStoryReplyForEveryone(reply.id),
    },
  ];

  if (isInternalUser) {
    menuOptions.push({
      icon: 'module-message__context--icon module-message__context__copy-timestamp',
      label: i18n('icu:StoryViewsNRepliesModal__copy-reply-timestamp'),
      onClick: () => {
        void window.navigator.clipboard.writeText(String(reply.timestamp));
      },
    });
  }

  return reply.author.isMe && !reply.deletedForEveryone ? (
    <ContextMenu i18n={i18n} key={reply.id} menuOptions={menuOptions}>
      {({ onClick, menuNode }) => (
        <>
          {renderContent(onClick)}
          {menuNode}
        </>
      )}
    </ContextMenu>
  ) : (
    renderContent()
  );
}
