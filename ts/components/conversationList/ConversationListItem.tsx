// Copyright 2018 Signal Messenger, LLC
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
import { isSignalConversation } from '../../util/isSignalConversation';
import { RenderLocation } from '../conversation/MessageTextRenderer';

const EMPTY_OBJECT = Object.freeze(Object.create(null));
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

export type MessageStatusType = (typeof MessageStatuses)[number];

export type PropsData = Pick<
  ConversationType,
  | 'acceptedMessageRequest'
  | 'avatarUrl'
  | 'badges'
  | 'color'
  | 'draftPreview'
  | 'groupId'
  | 'id'
  | 'isBlocked'
  | 'isMe'
  // NOTE: Passed for CI, not used for rendering
  | 'isPinned'
  | 'isSelected'
  | 'lastMessage'
  | 'lastUpdated'
  | 'markedUnread'
  | 'muteExpiresAt'
  | 'phoneNumber'
  | 'profileName'
  | 'removalStage'
  | 'sharedGroupNames'
  | 'shouldShowDraft'
  | 'title'
  | 'type'
  | 'typingContactIdTimestamps'
  | 'unblurredAvatarUrl'
  | 'unreadCount'
  | 'unreadMentionsCount'
  | 'serviceId'
> & {
  badge?: BadgeType;
};

type PropsHousekeeping = {
  buttonAriaLabel?: string;
  i18n: LocalizerType;
  onClick: (id: string) => void;
  onMouseDown: (id: string) => void;
  theme: ThemeType;
};

export type Props = PropsData & PropsHousekeeping;

export const ConversationListItem: FunctionComponent<Props> = React.memo(
  function ConversationListItem({
    acceptedMessageRequest,
    avatarUrl,
    badge,
    buttonAriaLabel,
    color,
    draftPreview,
    groupId,
    i18n,
    id,
    isBlocked,
    isMe,
    isSelected,
    lastMessage,
    lastUpdated,
    markedUnread,
    muteExpiresAt,
    onClick,
    onMouseDown,
    phoneNumber,
    profileName,
    removalStage,
    sharedGroupNames,
    shouldShowDraft,
    theme,
    title,
    type,
    typingContactIdTimestamps,
    unblurredAvatarUrl,
    unreadCount,
    unreadMentionsCount,
    serviceId,
  }) {
    const isMuted = Boolean(muteExpiresAt && Date.now() < muteExpiresAt);
    const isSomeoneTyping =
      Object.keys(typingContactIdTimestamps ?? {}).length > 0;
    const headerName = (
      <>
        {isMe ? (
          <ContactName
            module={HEADER_CONTACT_NAME_CLASS_NAME}
            isMe={isMe}
            title={i18n('icu:noteToSelf')}
          />
        ) : (
          <ContactName
            module={HEADER_CONTACT_NAME_CLASS_NAME}
            isSignalConversation={isSignalConversation({ id, serviceId })}
            title={title}
          />
        )}
        {isMuted && <div className={`${HEADER_NAME_CLASS_NAME}__mute-icon`} />}
      </>
    );

    let messageText: ReactNode = null;
    let messageStatusIcon: ReactNode = null;

    if (isBlocked) {
      messageText = (
        <span className={`${MESSAGE_TEXT_CLASS_NAME}__blocked`}>
          {i18n('icu:ConversationListItem--blocked')}
        </span>
      );
    } else if (!acceptedMessageRequest && removalStage !== 'justNotification') {
      messageText = (
        <span className={`${MESSAGE_TEXT_CLASS_NAME}__message-request`}>
          {i18n('icu:ConversationListItem--message-request')}
        </span>
      );
    } else if (isSomeoneTyping) {
      messageText = <TypingAnimation i18n={i18n} />;
    } else if (shouldShowDraft && draftPreview) {
      messageText = (
        <>
          <span className={`${MESSAGE_TEXT_CLASS_NAME}__draft-prefix`}>
            {i18n('icu:ConversationListItem--draft-prefix')}
          </span>
          <MessageBody
            bodyRanges={draftPreview.bodyRanges}
            disableJumbomoji
            disableLinks
            i18n={i18n}
            isSpoilerExpanded={{}}
            prefix={draftPreview.prefix}
            renderLocation={RenderLocation.ConversationList}
            text={draftPreview.text}
          />
        </>
      );
    } else if (lastMessage?.deletedForEveryone) {
      messageText = (
        <span className={`${MESSAGE_TEXT_CLASS_NAME}__deleted-for-everyone`}>
          {i18n('icu:message--deletedForEveryone')}
        </span>
      );
    } else if (lastMessage) {
      messageText = (
        <MessageBody
          author={type === 'group' ? lastMessage.author : undefined}
          bodyRanges={lastMessage.bodyRanges}
          disableJumbomoji
          disableLinks
          i18n={i18n}
          isSpoilerExpanded={EMPTY_OBJECT}
          prefix={lastMessage.prefix}
          renderLocation={RenderLocation.ConversationList}
          text={lastMessage.text}
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
    const onMouseDownItem = useCallback(
      () => onMouseDown(id),
      [onMouseDown, id]
    );

    return (
      <BaseConversationListItem
        acceptedMessageRequest={acceptedMessageRequest}
        avatarUrl={avatarUrl}
        badge={badge}
        buttonAriaLabel={buttonAriaLabel}
        color={color}
        conversationType={type}
        groupId={groupId}
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
        onClick={onClickItem}
        onMouseDown={onMouseDownItem}
        phoneNumber={phoneNumber}
        profileName={profileName}
        sharedGroupNames={sharedGroupNames}
        theme={theme}
        title={title}
        unreadCount={unreadCount}
        unreadMentionsCount={unreadMentionsCount}
        unblurredAvatarUrl={unblurredAvatarUrl}
        serviceId={serviceId}
      />
    );
  }
);
