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
const MESSAGE_CLASS_NAME = `${CONTENT_CLASS_NAME}__message`;
export const MESSAGE_TEXT_CLASS_NAME = `${MESSAGE_CLASS_NAME}__text`;
const CHECKBOX_CLASS_NAME = `${BASE_CLASS_NAME}__checkbox`;

type PropsType = {
  avatarPath?: string;
  checked?: boolean;
  color?: ColorType;
  conversationType: 'group' | 'direct';
  disabled?: boolean;
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
  onClick?: () => void;
  phoneNumber?: string;
  profileName?: string;
  style: CSSProperties;
  title: string;
  unreadCount?: number;
};

export const BaseConversationListItem: FunctionComponent<PropsType> = React.memo(
  ({
    avatarPath,
    checked,
    color,
    conversationType,
    disabled,
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

    const isCheckbox = isBoolean(checked);

    let checkboxNode: ReactNode;
    if (isCheckbox) {
      let ariaLabel: string;
      if (disabled) {
        ariaLabel = i18n('cannotSelectContact');
      } else if (checked) {
        ariaLabel = i18n('deselectContact');
      } else {
        ariaLabel = i18n('selectContact');
      }
      checkboxNode = (
        <input
          aria-label={ariaLabel}
          checked={checked}
          className={CHECKBOX_CLASS_NAME}
          disabled={disabled}
          onChange={onClick}
          onKeyDown={event => {
            if (onClick && !disabled && event.key === 'Enter') {
              onClick();
            }
          }}
          type="checkbox"
        />
      );
    }

    const contents = (
      <>
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
        <div
          className={classNames(
            CONTENT_CLASS_NAME,
            disabled && `${CONTENT_CLASS_NAME}--disabled`
          )}
        >
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
        {checkboxNode}
      </>
    );

    const commonClassNames = classNames(BASE_CLASS_NAME, {
      [`${BASE_CLASS_NAME}--has-unread`]: isUnread,
      [`${BASE_CLASS_NAME}--is-selected`]: isSelected,
    });

    if (isCheckbox) {
      return (
        <label
          className={classNames(
            commonClassNames,
            `${BASE_CLASS_NAME}--is-checkbox`,
            { [`${BASE_CLASS_NAME}--is-checkbox--disabled`]: disabled }
          )}
          data-id={id ? cleanId(id) : undefined}
          style={style}
          // `onClick` is will double-fire if we're enabled. We want it to fire when we're
          //   disabled so we can show any "can't add contact" modals, etc. This won't
          //   work for keyboard users, though, because labels are not tabbable.
          {...(disabled ? { onClick } : {})}
        >
          {contents}
        </label>
      );
    }

    if (onClick) {
      return (
        <button
          className={classNames(
            commonClassNames,
            `${BASE_CLASS_NAME}--is-button`
          )}
          data-id={id ? cleanId(id) : undefined}
          disabled={disabled}
          onClick={onClick}
          style={style}
          type="button"
        >
          {contents}
        </button>
      );
    }

    return (
      <div
        className={commonClassNames}
        data-id={id ? cleanId(id) : undefined}
        style={style}
      >
        {contents}
      </div>
    );
  }
);
