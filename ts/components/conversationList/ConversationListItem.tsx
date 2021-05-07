// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, {
  useCallback,
  CSSProperties,
  FunctionComponent,
  ReactNode,
} from 'react';
import classNames from 'classnames';

import {
  BaseConversationListItem,
  MESSAGE_TEXT_CLASS_NAME,
} from './BaseConversationListItem';
import { MessageBody } from '../conversation/MessageBody';
import { ContactName } from '../conversation/ContactName';
import { TypingAnimation } from '../conversation/TypingAnimation';

import { LocalizerType } from '../../types/Util';
import { ConversationType } from '../../state/ducks/conversations';

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
  | 'color'
  | 'draftPreview'
  | 'id'
  | 'isMe'
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
  | 'typingContact'
  | 'unblurredAvatarPath'
  | 'unreadCount'
>;

type PropsHousekeeping = {
  i18n: LocalizerType;
  style: CSSProperties;
  onClick: (id: string) => void;
};

export type Props = PropsData & PropsHousekeeping;

export const ConversationListItem: FunctionComponent<Props> = React.memo(
  ({
    acceptedMessageRequest,
    avatarPath,
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
    style,
    title,
    type,
    typingContact,
    unblurredAvatarPath,
    unreadCount,
  }) => {
    const headerName = isMe ? (
      i18n('noteToSelf')
    ) : (
      <ContactName
        phoneNumber={phoneNumber}
        name={name}
        profileName={profileName}
        title={title}
        i18n={i18n}
      />
    );

    let messageText: ReactNode = null;
    let messageStatusIcon: ReactNode = null;

    if (lastMessage || typingContact) {
      const messageBody = lastMessage ? lastMessage.text : '';
      const showingDraft = shouldShowDraft && draftPreview;
      const deletedForEveryone = Boolean(
        lastMessage && lastMessage.deletedForEveryone
      );

      /* eslint-disable no-nested-ternary */
      messageText = (
        <>
          {muteExpiresAt && Date.now() < muteExpiresAt ? (
            <span className={`${MESSAGE_TEXT_CLASS_NAME}__muted`} />
          ) : null}
          {!acceptedMessageRequest ? (
            <span className={`${MESSAGE_TEXT_CLASS_NAME}__message-request`}>
              {i18n('ConversationListItem--message-request')}
            </span>
          ) : typingContact ? (
            <TypingAnimation i18n={i18n} />
          ) : (
            <>
              {showingDraft ? (
                <>
                  <span className={`${MESSAGE_TEXT_CLASS_NAME}__draft-prefix`}>
                    {i18n('ConversationListItem--draft-prefix')}
                  </span>
                  <MessageBody
                    text={(draftPreview || '').split('\n')[0]}
                    disableJumbomoji
                    disableLinks
                    i18n={i18n}
                  />
                </>
              ) : deletedForEveryone ? (
                <span
                  className={`${MESSAGE_TEXT_CLASS_NAME}__deleted-for-everyone`}
                >
                  {i18n('message--deletedForEveryone')}
                </span>
              ) : (
                <MessageBody
                  text={(messageBody || '').split('\n')[0]}
                  disableJumbomoji
                  disableLinks
                  i18n={i18n}
                />
              )}
            </>
          )}
        </>
      );
      /* eslint-enable no-nested-ternary */

      if (!showingDraft && lastMessage && lastMessage.status) {
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
        name={name}
        onClick={onClickItem}
        phoneNumber={phoneNumber}
        profileName={profileName}
        sharedGroupNames={sharedGroupNames}
        style={style}
        title={title}
        unreadCount={unreadCount}
        unblurredAvatarPath={unblurredAvatarPath}
      />
    );
  }
);
