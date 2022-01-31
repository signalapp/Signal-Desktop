// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FunctionComponent, ReactNode } from 'react';
import React, { useCallback } from 'react';
import classNames from 'classnames';

import {
  BaseConversationListItem,
  HEADER_NAME_CLASS_NAME,
  HEADER_CONTACT_NAME_CLASS_NAME,
  MESSAGE_TEXT_CLASS_NAME,
} from './BaseConversationListItem';
import { MessageBody } from '../conversation/MessageBody';
import { ContactName } from '../conversation/ContactName';
import { TypingAnimation } from '../conversation/TypingAnimation';

import type { LocalizerType, ThemeType } from '../../types/Util';
import type { ConversationType } from '../../state/ducks/conversations';
import type { BadgeType } from '../../badges/types';

const MESSAGE_STATUS_ICON_CLASS_NAME = `${MESSAGE_TEXT_CLASS_NAME}__status-icon`;

export const MessageStatuses = [
  'sending',
  'sent',
  'delivered',
  'read',
  'paused',
  'error',
  'partial-sent',
] as const;

export type MessageStatusType = typeof MessageStatuses[number];

export type PropsData = Pick<
  ConversationType,
  | 'acceptedMessageRequest'
  | 'avatarPath'
  | 'badges'
  | 'color'
  | 'draftPreview'
  | 'id'
  | 'isMe'
  // NOTE: Passed for CI, not used for rendering
  | 'isPinned'
  | 'isSelected'
  | 'lastMessage'
  | 'lastUpdated'
  | 'markedUnread'
  | 'muteExpiresAt'
  | 'name'
  | 'phoneNumber'
  | 'profileName'
  | 'sharedGroupNames'
  | 'shouldShowDraft'
  | 'title'
  | 'type'
  | 'typingContactId'
  | 'unblurredAvatarPath'
  | 'unreadCount'
> & {
  badge?: BadgeType;
};

type PropsHousekeeping = {
  i18n: LocalizerType;
  onClick: (id: string) => void;
  theme: ThemeType;
};

export type Props = PropsData & PropsHousekeeping;

export const ConversationListItem: FunctionComponent<Props> = React.memo(
  function ConversationListItem({
    acceptedMessageRequest,
    avatarPath,
    badge,
    color,
    draftPreview,
    i18n,
    id,
    isMe,
    isSelected,
    lastMessage,
    lastUpdated,
    markedUnread,
    muteExpiresAt,
    name,
    onClick,
    phoneNumber,
    profileName,
    sharedGroupNames,
    shouldShowDraft,
    theme,
    title,
    type,
    typingContactId,
    unblurredAvatarPath,
    unreadCount,
  }) {
    const isMuted = Boolean(muteExpiresAt && Date.now() < muteExpiresAt);
    const headerName = (
      <>
        {isMe ? (
          <span className={HEADER_CONTACT_NAME_CLASS_NAME}>
            {i18n('noteToSelf')}
          </span>
        ) : (
          <ContactName module={HEADER_CONTACT_NAME_CLASS_NAME} title={title} />
        )}
        {isMuted && <div className={`${HEADER_NAME_CLASS_NAME}__mute-icon`} />}
      </>
    );

    let messageText: ReactNode = null;
    let messageStatusIcon: ReactNode = null;

    if (!acceptedMessageRequest) {
      messageText = (
        <span className={`${MESSAGE_TEXT_CLASS_NAME}__message-request`}>
          {i18n('ConversationListItem--message-request')}
        </span>
      );
    } else if (typingContactId) {
      messageText = <TypingAnimation i18n={i18n} />;
    } else if (shouldShowDraft && draftPreview) {
      messageText = (
        <>
          <span className={`${MESSAGE_TEXT_CLASS_NAME}__draft-prefix`}>
            {i18n('ConversationListItem--draft-prefix')}
          </span>
          <MessageBody
            text={truncateMessageText(draftPreview)}
            disableJumbomoji
            disableLinks
            i18n={i18n}
          />
        </>
      );
    } else if (lastMessage?.deletedForEveryone) {
      messageText = (
        <span className={`${MESSAGE_TEXT_CLASS_NAME}__deleted-for-everyone`}>
          {i18n('message--deletedForEveryone')}
        </span>
      );
    } else if (lastMessage) {
      messageText = (
        <MessageBody
          text={truncateMessageText(lastMessage.text)}
          disableJumbomoji
          disableLinks
          i18n={i18n}
        />
      );
      if (lastMessage.status) {
        messageStatusIcon = (
          <div
            className={classNames(
              MESSAGE_STATUS_ICON_CLASS_NAME,
              `${MESSAGE_STATUS_ICON_CLASS_NAME}--${lastMessage.status}`
            )}
          />
        );
      }
    }

    const onClickItem = useCallback(() => onClick(id), [onClick, id]);

    return (
      <BaseConversationListItem
        acceptedMessageRequest={acceptedMessageRequest}
        avatarPath={avatarPath}
        badge={badge}
        color={color}
        conversationType={type}
        headerDate={lastUpdated}
        headerName={headerName}
        i18n={i18n}
        id={id}
        isMe={isMe}
        isSelected={Boolean(isSelected)}
        markedUnread={markedUnread}
        messageStatusIcon={messageStatusIcon}
        messageText={messageText}
        messageTextIsAlwaysFullSize
        name={name}
        onClick={onClickItem}
        phoneNumber={phoneNumber}
        profileName={profileName}
        sharedGroupNames={sharedGroupNames}
        theme={theme}
        title={title}
        unreadCount={unreadCount}
        unblurredAvatarPath={unblurredAvatarPath}
      />
    );
  }
);

// This takes `unknown` because, sometimes, values from the database don't match our
//   types. In the long term, we should fix that. In the short term, this smooths over the
//   problem.
function truncateMessageText(text: unknown): string {
  if (typeof text !== 'string') {
    return '';
  }
  return text.replace(/(?:\r?\n)+/g, ' ');
}
