import React, { useCallback } from 'react';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import { contextMenu } from 'react-contexify';

import { Avatar, AvatarSize } from './Avatar';
import { MessageBody } from './conversation/MessageBody';
import { Timestamp } from './conversation/Timestamp';
import { ContactName } from './conversation/ContactName';
import { TypingAnimation } from './conversation/TypingAnimation';

import { ConversationAvatar } from './session/usingClosedConversationDetails';
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
import { useMembersAvatars } from '../hooks/useMembersAvatar';
import { SessionIcon } from './session/icon';
import { useDispatch, useSelector } from 'react-redux';
import { SectionType } from '../state/ducks/section';
import { getFocusedSection } from '../state/selectors/section';
import { ConversationNotificationSettingType } from '../models/conversation';
import { updateUserDetailsModal } from '../state/ducks/modalDialog';

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
};
// tslint:disable: use-simple-attributes

type Props = ConversationListItemProps & PropsHousekeeping;

const Portal = ({ children }: { children: any }) => {
  return createPortal(children, document.querySelector('.inbox.index') as Element);
};

const HeaderItem = (props: {
  unreadCount: number;
  isMe: boolean;
  mentionedUs: boolean;
  activeAt?: number;
  name?: string;
  profileName?: string;
  conversationId: string;
  isPinned: boolean;
  currentNotificationSetting: ConversationNotificationSettingType;
}) => {
  const {
    unreadCount,
    mentionedUs,
    activeAt,
    isMe,
    isPinned,
    conversationId,
    profileName,
    name,
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
        <UserItem
          isMe={isMe}
          conversationId={conversationId}
          name={name}
          profileName={profileName}
        />
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

const UserItem = (props: {
  name?: string;
  profileName?: string;
  isMe: boolean;
  conversationId: string;
}) => {
  const { name, conversationId, profileName, isMe } = props;

  const shortenedPubkey = PubKey.shorten(conversationId);

  const displayedPubkey = profileName ? shortenedPubkey : conversationId;
  const displayName = isMe ? window.i18n('noteToSelf') : profileName;

  let shouldShowPubkey = false;
  if ((!name || name.length === 0) && (!displayName || displayName.length === 0)) {
    shouldShowPubkey = true;
  }

  return (
    <div className="module-conversation__user">
      <ContactName
        pubkey={displayedPubkey}
        name={name}
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

const AvatarItem = (props: {
  avatarPath: string | null;
  conversationId: string;
  memberAvatars?: Array<ConversationAvatar>;
  name?: string;
  profileName?: string;
  isPrivate: boolean;
}) => {
  const { avatarPath, name, isPrivate, conversationId, profileName, memberAvatars } = props;

  const userName = name || profileName || conversationId;
  const dispatch = useDispatch();

  return (
    <div className="module-conversation-list-item__avatar-container">
      <Avatar
        avatarPath={avatarPath}
        name={userName}
        size={AvatarSize.S}
        memberAvatars={memberAvatars}
        pubkey={conversationId}
        onAvatarClick={() => {
          if (isPrivate) {
            dispatch(
              updateUserDetailsModal({
                conversationId: conversationId,
                userName,
                authorAvatarPath: avatarPath,
              })
            );
          }
        }}
      />
    </div>
  );
};

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
    name,
    isPinned,
    profileName,
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
  } = props;
  const triggerId = `conversation-item-${conversationId}-ctxmenu`;
  const key = `conversation-item-${conversationId}`;

  const membersAvatar = useMembersAvatars(props);

  const openConvo = useCallback(
    async (e: React.MouseEvent<HTMLDivElement>) => {
      // mousedown is invoked sooner than onClick, but for both right and left click
      if (e.button === 0) {
        await openConversationWithMessages({ conversationKey: conversationId });
      }
    },
    [conversationId]
  );

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
        <AvatarItem
          conversationId={conversationId}
          avatarPath={avatarPath || null}
          memberAvatars={membersAvatar}
          profileName={profileName}
          name={name}
          isPrivate={isPrivate || false}
        />
        <div className="module-conversation-list-item__content">
          <HeaderItem
            mentionedUs={!!mentionedUs}
            unreadCount={unreadCount || 0}
            activeAt={activeAt}
            isMe={!!isMe}
            isPinned={!!isPinned}
            conversationId={conversationId}
            name={name}
            profileName={profileName}
            currentNotificationSetting={currentNotificationSetting || 'all'}
          />
          <MessageItem
            isTyping={!!isTyping}
            unreadCount={unreadCount || 0}
            lastMessage={lastMessage}
          />
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
          name={name}
          profileName={profileName}
        />
      </Portal>
    </div>
  );
};

export const MemoConversationListItemWithDetails = React.memo(ConversationListItem, _.isEqual);
