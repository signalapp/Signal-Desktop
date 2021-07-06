import React from 'react';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import { contextMenu } from 'react-contexify';

import { Avatar, AvatarSize } from './Avatar';
import { MessageBody } from './conversation/MessageBody';
import { Timestamp } from './conversation/Timestamp';
import { ContactName } from './conversation/ContactName';
import { TypingAnimation } from './conversation/TypingAnimation';

import {
  ConversationAvatar,
  usingClosedConversationDetails,
} from './session/usingClosedConversationDetails';
import { MemoConversationListItemContextMenu } from './session/menu/ConversationListItemContextMenu';
import { createPortal } from 'react-dom';
import { OutgoingMessageStatus } from './conversation/message/OutgoingMessageStatus';
import { DefaultTheme, useTheme } from 'styled-components';
import { PubKey } from '../session/types';
import {
  ConversationType,
  LastMessageType,
  openConversationExternal,
} from '../state/ducks/conversations';
import _ from 'underscore';

export interface ConversationListItemProps extends ConversationType {
  index?: number; // used to force a refresh when one conversation is removed on top of the list
  memberAvatars?: Array<ConversationAvatar>; // this is added by usingClosedConversationDetails
}

type PropsHousekeeping = {
  style?: Object;
};

type Props = ConversationListItemProps & PropsHousekeeping;

const Portal = ({ children }: { children: any }) => {
  return createPortal(children, document.querySelector('.inbox.index') as Element);
};

const AvatarItem = (props: {
  avatarPath?: string;
  phoneNumber: string;
  memberAvatars?: Array<ConversationAvatar>;
  name?: string;
  profileName?: string;
}) => {
  const { avatarPath, name, phoneNumber, profileName, memberAvatars } = props;

  const userName = name || profileName || phoneNumber;

  return (
    <div className="module-conversation-list-item__avatar-container">
      <Avatar
        avatarPath={avatarPath}
        name={userName}
        size={AvatarSize.S}
        memberAvatars={memberAvatars}
        pubkey={phoneNumber}
      />
    </div>
  );
};

const UserItem = (props: {
  name?: string;
  profileName?: string;
  isMe: boolean;
  phoneNumber: string;
}) => {
  const { name, phoneNumber, profileName, isMe } = props;

  const shortenedPubkey = PubKey.shorten(phoneNumber);

  const displayedPubkey = profileName ? shortenedPubkey : phoneNumber;
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
  phoneNumber: string;
}) => {
  const { unreadCount, mentionedUs, activeAt, isMe, phoneNumber, profileName, name } = props;

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
        <UserItem isMe={isMe} phoneNumber={phoneNumber} name={name} profileName={profileName} />
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
  console.warn('ConversationListItem', props.id.substr(-1), ': ', props);
  const {
    activeAt,
    phoneNumber,
    unreadCount,
    id,
    isSelected,
    isBlocked,
    style,
    mentionedUs,
    isMe,
    name,
    profileName,
    memberAvatars,
    isTyping,
    lastMessage,
    hasNickname,
    isKickedFromGroup,
    left,
    type,
    isPublic,
    avatarPath,
  } = props;
  const triggerId = `conversation-item-${phoneNumber}-ctxmenu`;
  const key = `conversation-item-${phoneNumber}`;

  return (
    <div key={key}>
      <div
        role="button"
        onClick={() => {
          window.inboxStore?.dispatch(openConversationExternal(id));
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
          phoneNumber={phoneNumber}
          avatarPath={avatarPath}
          memberAvatars={memberAvatars}
          profileName={profileName}
          name={name}
        />
        <div className="module-conversation-list-item__content">
          <HeaderItem
            mentionedUs={mentionedUs}
            unreadCount={unreadCount}
            activeAt={activeAt}
            isMe={isMe}
            phoneNumber={phoneNumber}
            name={name}
            profileName={profileName}
          />
          <MessageItem isTyping={isTyping} unreadCount={unreadCount} lastMessage={lastMessage} />
        </div>
      </div>
      <Portal>
        <MemoConversationListItemContextMenu
          triggerId={triggerId}
          conversationId={id}
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

export const MemoConversationListItemWithDetails = usingClosedConversationDetails(
  React.memo(ConversationListItem, _.isEqual)
);
