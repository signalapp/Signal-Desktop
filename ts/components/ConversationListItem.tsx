import React, { useCallback } from 'react';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import { contextMenu } from 'react-contexify';

import { Avatar, AvatarSize } from './Avatar';
import { MessageBody } from './conversation/MessageBody';
import { Timestamp } from './conversation/Timestamp';
import { ContactName } from './conversation/ContactName';
import { TypingAnimation } from './conversation/TypingAnimation';

import { MemoConversationListItemContextMenu } from './session/menu/ConversationListItemContextMenu';
import { createPortal } from 'react-dom';
import { OutgoingMessageStatus } from './conversation/message/OutgoingMessageStatus';
import styled from 'styled-components';
import { PubKey } from '../session/types';
import {
  LastMessageType,
  openConversationWithMessages,
  ReduxConversationType,
} from '../state/ducks/conversations';
import _ from 'underscore';
import { SessionIcon } from './session/icon';
import { useDispatch, useSelector } from 'react-redux';
import { SectionType } from '../state/ducks/section';
import { getFocusedSection } from '../state/selectors/section';
import { ConversationNotificationSettingType } from '../models/conversation';
import { Flex } from './basic/Flex';
import { forceSyncConfigurationNowIfNeeded } from '../session/utils/syncUtils';
import { updateUserDetailsModal } from '../state/ducks/modalDialog';
import { approveConversation, blockConvoById } from '../interactions/conversationInteractions';
import { useAvatarPath, useConversationUsername, useIsMe } from '../hooks/useParamSelector';

// tslint:disable-next-line: no-empty-interface
export interface ConversationListItemProps extends ReduxConversationType {}

export const StyledConversationListItemIconWrapper = styled.div`
  svg {
    margin: 0px 2px;
  }

  display: flex;
  flex-direction: row;
`;

type PropsHousekeeping = {
  style?: Object;
  isMessageRequest?: boolean;
};
// tslint:disable: use-simple-attributes

type Props = ConversationListItemProps & PropsHousekeeping;

const Portal = ({ children }: { children: any }) => {
  return createPortal(children, document.querySelector('.inbox.index') as Element);
};

const HeaderItem = (props: {
  unreadCount: number;
  mentionedUs: boolean;
  activeAt?: number;
  conversationId: string;
  isPinned: boolean;
  currentNotificationSetting: ConversationNotificationSettingType;
}) => {
  const {
    unreadCount,
    mentionedUs,
    activeAt,
    isPinned,
    conversationId,
    currentNotificationSetting,
  } = props;

  let atSymbol = null;
  let unreadCountDiv = null;
  if (unreadCount > 0) {
    atSymbol = mentionedUs ? <p className="at-symbol">@</p> : null;
    unreadCountDiv = <p className="module-conversation-list-item__unread-count">{unreadCount}</p>;
  }

  const isMessagesSection = useSelector(getFocusedSection) === SectionType.Message;

  const pinIcon =
    isMessagesSection && isPinned ? (
      <SessionIcon iconType="pin" iconColor={'var(--color-text-subtle)'} iconSize={'small'} />
    ) : null;

  const NotificationSettingIcon = () => {
    if (!isMessagesSection) {
      return null;
    }

    switch (currentNotificationSetting) {
      case 'all':
        return null;
      case 'disabled':
        return (
          <SessionIcon iconType="mute" iconColor={'var(--color-text-subtle)'} iconSize={'small'} />
        );
      case 'mentions_only':
        return (
          <SessionIcon iconType="bell" iconColor={'var(--color-text-subtle)'} iconSize={'small'} />
        );
      default:
        return null;
    }
  };

  return (
    <div className="module-conversation-list-item__header">
      <div
        className={classNames(
          'module-conversation-list-item__header__name',
          unreadCount > 0 ? 'module-conversation-list-item__header__name--with-unread' : null
        )}
      >
        <UserItem conversationId={conversationId} />
      </div>

      <StyledConversationListItemIconWrapper>
        {pinIcon}
        <NotificationSettingIcon />
      </StyledConversationListItemIconWrapper>
      {unreadCountDiv}
      {atSymbol}

      <div
        className={classNames(
          'module-conversation-list-item__header__date',
          unreadCount > 0 ? 'module-conversation-list-item__header__date--has-unread' : null
        )}
      >
        <Timestamp timestamp={activeAt} extended={false} isConversationListItem={true} />
      </div>
    </div>
  );
};

const UserItem = (props: { conversationId: string }) => {
  const { conversationId } = props;

  const shortenedPubkey = PubKey.shorten(conversationId);
  const isMe = useIsMe(conversationId);
  const username = useConversationUsername(conversationId);

  const displayedPubkey = username ? shortenedPubkey : conversationId;
  const displayName = isMe ? window.i18n('noteToSelf') : username;

  let shouldShowPubkey = false;
  if ((!username || username.length === 0) && (!displayName || displayName.length === 0)) {
    shouldShowPubkey = true;
  }

  return (
    <div className="module-conversation__user">
      <ContactName
        pubkey={displayedPubkey}
        name={username}
        profileName={displayName}
        module="module-conversation__user"
        boldProfileName={true}
        shouldShowPubkey={shouldShowPubkey}
      />
    </div>
  );
};

const MessageItem = (props: {
  lastMessage?: LastMessageType;
  isTyping: boolean;
  unreadCount: number;
}) => {
  const { lastMessage, isTyping, unreadCount } = props;

  if (!lastMessage && !isTyping) {
    return null;
  }
  const text = lastMessage?.text || '';

  if (isEmpty(text)) {
    return null;
  }

  return (
    <div className="module-conversation-list-item__message">
      <div
        className={classNames(
          'module-conversation-list-item__message__text',
          unreadCount > 0 ? 'module-conversation-list-item__message__text--has-unread' : null
        )}
      >
        {isTyping ? (
          <TypingAnimation />
        ) : (
          <MessageBody isGroup={true} text={text} disableJumbomoji={true} disableLinks={true} />
        )}
      </div>
      {lastMessage && lastMessage.status ? (
        <OutgoingMessageStatus status={lastMessage.status} />
      ) : null}
    </div>
  );
};

const AvatarItem = (props: { conversationId: string; isPrivate: boolean }) => {
  const { isPrivate, conversationId } = props;
  const userName = useConversationUsername(conversationId);
  const avatarPath = useAvatarPath(conversationId);
  const dispatch = useDispatch();

  return (
    <div className="module-conversation-list-item__avatar-container">
      <Avatar
        size={AvatarSize.S}
        pubkey={conversationId}
        onAvatarClick={() => {
          if (isPrivate) {
            dispatch(
              updateUserDetailsModal({
                conversationId: conversationId,
                userName: userName || '',
                authorAvatarPath: avatarPath,
              })
            );
          }
        }}
      />
    </div>
  );
};

// tslint:disable: max-func-body-length
const ConversationListItem = (props: Props) => {
  const {
    activeAt,
    unreadCount,
    id: conversationId,
    isSelected,
    isBlocked,
    style,
    mentionedUs,
    isMe,
    isPinned,
    isTyping,
    lastMessage,
    hasNickname,
    isKickedFromGroup,
    left,
    type,
    isPublic,
    avatarPath,
    isPrivate,
    currentNotificationSetting,
    isMessageRequest,
  } = props;
  const triggerId = `conversation-item-${conversationId}-ctxmenu`;
  const key = `conversation-item-${conversationId}`;

  const openConvo = useCallback(
    async (e: React.MouseEvent<HTMLDivElement>) => {
      // mousedown is invoked sooner than onClick, but for both right and left click
      if (e.button === 0) {
        await openConversationWithMessages({ conversationKey: conversationId });
      }
    },
    [conversationId]
  );

  /**
   * Removes conversation from requests list,
   * adds ID to block list, syncs the block with linked devices.
   */
  const handleConversationBlock = async () => {
    await blockConvoById(conversationId);
    await forceSyncConfigurationNowIfNeeded();
  };

  return (
    <div key={key}>
      <div
        role="button"
        onMouseDown={openConvo}
        onMouseUp={e => {
          e.stopPropagation();
          e.preventDefault();
        }}
        onContextMenu={(e: any) => {
          contextMenu.show({
            id: triggerId,
            event: e,
          });
        }}
        style={style}
        className={classNames(
          'module-conversation-list-item',
          unreadCount && unreadCount > 0 ? 'module-conversation-list-item--has-unread' : null,
          unreadCount && unreadCount > 0 && mentionedUs
            ? 'module-conversation-list-item--mentioned-us'
            : null,
          isSelected ? 'module-conversation-list-item--is-selected' : null,
          isBlocked ? 'module-conversation-list-item--is-blocked' : null
        )}
      >
        <AvatarItem conversationId={conversationId} isPrivate={isPrivate || false} />
        <div className="module-conversation-list-item__content">
          <HeaderItem
            mentionedUs={!!mentionedUs}
            unreadCount={unreadCount || 0}
            activeAt={activeAt}
            isPinned={!!isPinned}
            conversationId={conversationId}
            currentNotificationSetting={currentNotificationSetting || 'all'}
          />
          <MessageItem
            isTyping={!!isTyping}
            unreadCount={unreadCount || 0}
            lastMessage={lastMessage}
          />
          {isMessageRequest ? (
            <Flex
              className="module-conversation-list-item__button-container"
              container={true}
              flexDirection="row"
              justifyContent="flex-end"
            >
              <SessionIconButton
                iconType="exit"
                iconSize="large"
                onClick={handleConversationBlock}
                backgroundColor="var(--color-destructive)"
                iconColor="var(--color-foreground-primary)"
                iconPadding="var(--margins-xs)"
                borderRadius="2px"
              />
              <SessionIconButton
                iconType="check"
                iconSize="large"
                onClick={async () => {
                  await approveConversation(conversationId);
                }}
                backgroundColor="var(--color-accent)"
                iconColor="var(--color-foreground-primary)"
                iconPadding="var(--margins-xs)"
                borderRadius="2px"
              />
            </Flex>
          ) : null}
        </div>
      </div>
      <Portal>
        <MemoConversationListItemContextMenu
          triggerId={triggerId}
          conversationId={conversationId}
          hasNickname={!!hasNickname}
          isBlocked={!!isBlocked}
          isPrivate={!!isPrivate}
          isKickedFromGroup={!!isKickedFromGroup}
          isMe={!!isMe}
          isPublic={!!isPublic}
          left={!!left}
          type={type}
          currentNotificationSetting={currentNotificationSetting || 'all'}
          avatarPath={avatarPath || null}
        />
      </Portal>
    </div>
  );
};

export const MemoConversationListItemWithDetails = React.memo(ConversationListItem, _.isEqual);
