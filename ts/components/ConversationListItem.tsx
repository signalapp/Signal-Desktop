import React from 'react';
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
import { useTheme } from 'styled-components';
import { PubKey } from '../session/types';
import {
  LastMessageType,
  openConversationExternal,
  ReduxConversationType,
} from '../state/ducks/conversations';
import _ from 'underscore';
import { useMembersAvatars } from '../hooks/useMembersAvatar';
import { useDispatch } from 'react-redux';

export interface ConversationListItemProps extends ReduxConversationType {}

type PropsHousekeeping = {
  style?: Object;
};

type Props = ConversationListItemProps & PropsHousekeeping;

const Portal = ({ children }: { children: any }) => {
  return createPortal(children, document.querySelector('.inbox.index') as Element);
};

const AvatarItem = (props: {
  avatarPath?: string;
  conversationId: string;
  memberAvatars?: Array<ConversationAvatar>;
  name?: string;
  profileName?: string;
}) => {
  const { avatarPath, name, conversationId, profileName, memberAvatars } = props;

  const userName = name || profileName || conversationId;

  return (
    <div className="module-conversation-list-item__avatar-container">
      <Avatar
        avatarPath={avatarPath}
        name={userName}
        size={AvatarSize.S}
        memberAvatars={memberAvatars}
        pubkey={conversationId}
      />
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
        phoneNumber={displayedPubkey}
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
  isTyping: boolean;
  lastMessage?: LastMessageType;
  unreadCount: number;
}) => {
  const { lastMessage, isTyping, unreadCount } = props;

  const theme = useTheme();

  if (!lastMessage && !isTyping) {
    return null;
  }
  const text = lastMessage && lastMessage.text ? lastMessage.text : '';

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
        <OutgoingMessageStatus
          status={lastMessage.status}
          iconColor={theme.colors.textColorSubtle}
        />
      ) : null}
    </div>
  );
};

const HeaderItem = (props: {
  unreadCount: number;
  isMe: boolean;
  mentionedUs: boolean;
  activeAt?: number;
  name?: string;
  profileName?: string;
  conversationId: string;
}) => {
  const { unreadCount, mentionedUs, activeAt, isMe, conversationId, profileName, name } = props;

  let atSymbol = null;
  let unreadCountDiv = null;
  if (unreadCount > 0) {
    atSymbol = mentionedUs ? <p className="at-symbol">@</p> : null;
    unreadCountDiv = <p className="module-conversation-list-item__unread-count">{unreadCount}</p>;
  }

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
      {unreadCountDiv}
      {atSymbol}
      {
        <div
          className={classNames(
            'module-conversation-list-item__header__date',
            unreadCount > 0 ? 'module-conversation-list-item__header__date--has-unread' : null
          )}
        >
          {<Timestamp timestamp={activeAt} extended={false} isConversationListItem={true} />}
        </div>
      }
    </div>
  );
};

const ConversationListItem = (props: Props) => {
  // console.warn('ConversationListItem', props.id.substr(-1), ': ', props);
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
    profileName,
    isTyping,
    lastMessage,
    hasNickname,
    isKickedFromGroup,
    left,
    type,
    isPublic,
    avatarPath,
  } = props;
  const triggerId = `conversation-item-${conversationId}-ctxmenu`;
  const key = `conversation-item-${conversationId}`;

  const membersAvatar = useMembersAvatars(props);

  const dispatch = useDispatch();

  return (
    <div key={key}>
      <div
        role="button"
        onClick={() => {
          dispatch(openConversationExternal(conversationId));
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
          unreadCount > 0 ? 'module-conversation-list-item--has-unread' : null,
          unreadCount > 0 && mentionedUs ? 'module-conversation-list-item--mentioned-us' : null,
          isSelected ? 'module-conversation-list-item--is-selected' : null,
          isBlocked ? 'module-conversation-list-item--is-blocked' : null
        )}
      >
        <AvatarItem
          conversationId={conversationId}
          avatarPath={avatarPath}
          memberAvatars={membersAvatar}
          profileName={profileName}
          name={name}
        />
        <div className="module-conversation-list-item__content">
          <HeaderItem
            mentionedUs={mentionedUs}
            unreadCount={unreadCount}
            activeAt={activeAt}
            isMe={isMe}
            conversationId={conversationId}
            name={name}
            profileName={profileName}
          />
          <MessageItem isTyping={isTyping} unreadCount={unreadCount} lastMessage={lastMessage} />
        </div>
      </div>
      <Portal>
        <MemoConversationListItemContextMenu
          triggerId={triggerId}
          conversationId={conversationId}
          hasNickname={hasNickname}
          isBlocked={isBlocked}
          isKickedFromGroup={isKickedFromGroup}
          isMe={isMe}
          isPublic={isPublic}
          left={left}
          type={type}
        />
      </Portal>
    </div>
  );
};

export const MemoConversationListItemWithDetails = React.memo(ConversationListItem, _.isEqual);
