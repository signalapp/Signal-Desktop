// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { ReactNode, CSSProperties, FunctionComponent } from 'react';
import classNames from 'classnames';
import { isBoolean, isNumber } from 'lodash';

import { Avatar, AvatarSize } from '../Avatar';
import { Timestamp } from '../conversation/Timestamp';
import { isConversationUnread } from '../../util/isConversationUnread';
import { cleanId } from '../_util';
import { ColorType } from '../../types/Colors';
import { LocalizerType } from '../../types/Util';

const BASE_CLASS_NAME =
  'module-conversation-list__item--contact-or-conversation';
const CONTENT_CLASS_NAME = `${BASE_CLASS_NAME}__content`;
const HEADER_CLASS_NAME = `${CONTENT_CLASS_NAME}__header`;
export const DATE_CLASS_NAME = `${HEADER_CLASS_NAME}__date`;
const TIMESTAMP_CLASS_NAME = `${DATE_CLASS_NAME}__timestamp`;
export const MESSAGE_CLASS_NAME = `${CONTENT_CLASS_NAME}__message`;
export const MESSAGE_TEXT_CLASS_NAME = `${MESSAGE_CLASS_NAME}__text`;

type PropsType = {
  avatarPath?: string;
  color?: ColorType;
  conversationType: 'group' | 'direct';
  headerDate?: number;
  headerName: ReactNode;
  i18n: LocalizerType;
  id?: string;
  isMe?: boolean;
  isNoteToSelf?: boolean;
  isSelected: boolean;
  markedUnread?: boolean;
  messageId?: string;
  messageStatusIcon?: ReactNode;
  messageText?: ReactNode;
  name?: string;
  onClick: () => void;
  phoneNumber?: string;
  profileName?: string;
  style: CSSProperties;
  title: string;
  unreadCount?: number;
};

export const BaseConversationListItem: FunctionComponent<PropsType> = React.memo(
  ({
    avatarPath,
    color,
    conversationType,
    headerDate,
    headerName,
    i18n,
    id,
    isMe,
    isNoteToSelf,
    isSelected,
    markedUnread,
    messageStatusIcon,
    messageText,
    name,
    onClick,
    phoneNumber,
    profileName,
    style,
    title,
    unreadCount,
  }) => {
    const isUnread = isConversationUnread({ markedUnread, unreadCount });

    const isAvatarNoteToSelf = isBoolean(isNoteToSelf)
      ? isNoteToSelf
      : Boolean(isMe);

    return (
      <button
        type="button"
        onClick={onClick}
        style={style}
        className={classNames(BASE_CLASS_NAME, {
          [`${BASE_CLASS_NAME}--has-unread`]: isUnread,
          [`${BASE_CLASS_NAME}--is-selected`]: isSelected,
        })}
        data-id={id ? cleanId(id) : undefined}
      >
        <div className={`${BASE_CLASS_NAME}__avatar-container`}>
          <Avatar
            avatarPath={avatarPath}
            color={color}
            noteToSelf={isAvatarNoteToSelf}
            conversationType={conversationType}
            i18n={i18n}
            name={name}
            phoneNumber={phoneNumber}
            profileName={profileName}
            title={title}
            size={AvatarSize.FIFTY_TWO}
          />
          {isUnread && (
            <div className={`${BASE_CLASS_NAME}__unread-count`}>
              {unreadCount || ''}
            </div>
          )}
        </div>
        <div className={CONTENT_CLASS_NAME}>
          <div className={HEADER_CLASS_NAME}>
            <div className={`${HEADER_CLASS_NAME}__name`}>{headerName}</div>
            {isNumber(headerDate) && (
              <div
                className={classNames(DATE_CLASS_NAME, {
                  [`${DATE_CLASS_NAME}--has-unread`]: isUnread,
                })}
              >
                <Timestamp
                  timestamp={headerDate}
                  extended={false}
                  module={TIMESTAMP_CLASS_NAME}
                  withUnread={isUnread}
                  i18n={i18n}
                />
              </div>
            )}
          </div>
          {messageText ? (
            <div className={MESSAGE_CLASS_NAME}>
              <div
                dir="auto"
                className={classNames(MESSAGE_TEXT_CLASS_NAME, {
                  [`${MESSAGE_TEXT_CLASS_NAME}--has-unread`]: isUnread,
                })}
              >
                {messageText}
              </div>
              {messageStatusIcon}
            </div>
          ) : null}
        </div>
      </button>
    );
  }
);
