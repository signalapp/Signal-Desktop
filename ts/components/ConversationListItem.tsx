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
import {
  ConversationListItemContextMenu,
  PropsContextConversationItem,
} from './session/menu/ConversationListItemContextMenu';
import { createPortal } from 'react-dom';
import { OutgoingMessageStatus } from './conversation/message/OutgoingMessageStatus';
import { DefaultTheme, useTheme, withTheme } from 'styled-components';
import { PubKey } from '../session/types';
import {
  ConversationType,
  LastMessageType,
  openConversationExternal,
} from '../state/ducks/conversations';
import { SessionIcon, SessionIconSize, SessionIconType } from './session/icon';
import { useDispatch, useSelector } from 'react-redux';
import { SectionType } from './session/ActionsPanel';
import { getTheme } from '../state/selectors/theme';
import { getFocusedSection } from '../state/selectors/section';

export interface ConversationListItemProps extends ConversationType {
  index?: number; // used to force a refresh when one conversation is removed on top of the list
  memberAvatars?: Array<ConversationAvatar>; // this is added by usingClosedConversationDetails
}

type PropsHousekeeping = {
  style?: Object;
  theme: DefaultTheme;
};

type Props = ConversationListItemProps & PropsHousekeeping;

const Portal = ({ children }: { children: any }) => {
  return createPortal(children, document.querySelector('.inbox.index') as Element);
};

const ConversationListItem = (props: Props) => {
  const {
    phoneNumber,
    unreadCount,
    id,
    isSelected,
    isBlocked,
    style,
    mentionedUs,
    avatarPath,
    name,
    profileName,
    activeAt,
    isMe,
    isPinned,
    isTyping,
    type,
    lastMessage,
    memberAvatars,
  } = props;
  const triggerId: string = `conversation-item-${phoneNumber}-ctxmenu`;
  const key: string = `conversation-item-${phoneNumber}`;

  const dispatch = useDispatch();

  return (
    <div key={key}>
      <div
        role="button"
        onClick={() => {
          dispatch(openConversationExternal(id));
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
        <ConversationListItemAvatar
          avatarPath={avatarPath}
          name={name}
          profileName={profileName}
          memberAvatars={memberAvatars}
        />
        <div className="module-conversation-list-item__content">
          <ConversationListItemHeader
            unreadCount={unreadCount}
            mentionedUs={mentionedUs}
            activeAt={activeAt}
            isPinned={isPinned}
            name={name}
            phoneNumber={phoneNumber}
            profileName={profileName}
            isMe={isMe}
          />
          <ConversationListItemMessage
            lastMessage={lastMessage}
            isTyping={isTyping}
            unreadCount={unreadCount}
          />
        </div>
      </div>
      <Portal>
        <ConversationListItemContextMenu id={id} triggerId={triggerId} type={type} isMe={isMe} />
      </Portal>
    </div>
  );
};

export interface ConversationListItemAvatarProps {
  avatarPath?: string;
  name?: string;
  profileName?: string;
  phoneNumber?: string;
  memberAvatars?: Array<ConversationAvatar>;
}

export const ConversationListItemAvatar = (props: ConversationListItemAvatarProps) => {
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

export interface ConversationListItemHeaderProps {
  unreadCount: number;
  mentionedUs: boolean;
  activeAt?: number;
  isPinned?: boolean;

  name?: string;
  phoneNumber: string;
  profileName?: string;
  isMe: boolean;
}

export const ConversationListItemHeader = (props: ConversationListItemHeaderProps) => {
  const {
    unreadCount,
    mentionedUs,
    activeAt,
    isPinned,
    name,
    phoneNumber,
    profileName,
    isMe,
  } = props;

  const theme = useTheme();

  let atSymbol = null;
  let unreadCountDiv = null;
  if (unreadCount > 0) {
    atSymbol = mentionedUs ? <p className="at-symbol">@</p> : null;
    unreadCountDiv = <p className="module-conversation-list-item__unread-count">{unreadCount}</p>;
  }

  const isMessagesSection = useSelector(getFocusedSection) === SectionType.Message;

  const pinIcon =
    isMessagesSection && isPinned ? (
      <SessionIcon
        iconType={SessionIconType.Pin}
        iconColor={theme.colors.textColorSubtle}
        iconSize={SessionIconSize.Tiny}
      />
    ) : null;

  return (
    <div className="module-conversation-list-item__header">
      <div
        className={classNames(
          'module-conversation-list-item__header__name',
          unreadCount > 0 ? 'module-conversation-list-item__header__name--with-unread' : null
        )}
      >
        <ConversationListItemUser
          name={name}
          phoneNumber={phoneNumber}
          profileName={profileName}
          isMe={isMe}
        />
      </div>

      {pinIcon}
      {unreadCountDiv}
      {atSymbol}
      {
        <div
          className={classNames(
            'module-conversation-list-item__header__date',
            unreadCount > 0 ? 'module-conversation-list-item__header__date--has-unread' : null
          )}
        >
          {
            <Timestamp
              timestamp={activeAt}
              extended={false}
              isConversationListItem={true}
              theme={theme}
            />
          }
        </div>
      }
    </div>
  );
};

export interface ConversationListMessageProps {
  lastMessage: LastMessageType;
  isTyping: boolean;
  unreadCount: number;
}

export const ConversationListItemMessage = (props: any) => {
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
          theme={theme}
        />
      ) : null}
    </div>
  );
};

export interface ConversationListItemUserProps {
  name?: string;
  phoneNumber: string;
  profileName?: string;
  isMe: boolean;
}

export const ConversationListItemUser = (props: ConversationListItemUserProps) => {
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

export const ConversationListItemWithDetails = usingClosedConversationDetails(
  withTheme(ConversationListItem)
);
