// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode, FunctionComponent } from 'react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import classNames from 'classnames';
import lodash from 'lodash';
import { v4 as generateUuid } from 'uuid';

import { Avatar, AvatarSize } from '../Avatar.dom.js';
import type { BadgeType } from '../../badges/types.std.js';
import { isConversationUnread } from '../../util/isConversationUnread.std.js';
import { cleanId } from '../_util.std.js';
import type { LocalizerType, ThemeType } from '../../types/Util.std.js';
import type { ConversationType } from '../../state/ducks/conversations.preload.js';
import { Spinner } from '../Spinner.dom.js';
import { Time } from '../Time.dom.js';
import { formatDateTimeShort } from '../../util/formatTimestamp.dom.js';
import * as durations from '../../util/durations/index.std.js';

const { isBoolean, isNumber } = lodash;

const BASE_CLASS_NAME =
  'module-conversation-list__item--contact-or-conversation';
const AVATAR_CONTAINER_CLASS_NAME = `${BASE_CLASS_NAME}__avatar-container`;
const CONTENT_CLASS_NAME = `${BASE_CLASS_NAME}__content`;
const HEADER_CLASS_NAME = `${CONTENT_CLASS_NAME}__header`;
export const HEADER_NAME_CLASS_NAME = `${HEADER_CLASS_NAME}__name`;
export const HEADER_CONTACT_NAME_CLASS_NAME = `${HEADER_NAME_CLASS_NAME}__contact-name`;
export const DATE_CLASS_NAME = `${HEADER_CLASS_NAME}__date`;
const MESSAGE_CLASS_NAME = `${CONTENT_CLASS_NAME}__message`;
export const MESSAGE_TEXT_CLASS_NAME = `${MESSAGE_CLASS_NAME}__text`;
const CHECKBOX_CONTAINER_CLASS_NAME = `${BASE_CLASS_NAME}__checkbox--container`;
const CHECKBOX_CLASS_NAME = `${BASE_CLASS_NAME}__checkbox`;
export const SPINNER_CLASS_NAME = `${BASE_CLASS_NAME}__spinner`;

export type RenderConversationListItemContextMenuProps = Readonly<{
  conversationId: string;
  children: ReactNode;
}>;

type PropsType = {
  buttonAriaLabel?: string;
  checked?: boolean;
  conversationType: 'group' | 'direct';
  disabled?: boolean;
  headerDate?: number;
  headerName: ReactNode;
  id?: string;
  i18n: LocalizerType;
  isNoteToSelf?: boolean;
  isSelected: boolean;
  isUsernameSearchResult?: boolean;
  markedUnread?: boolean;
  messageId?: string;
  messageStatusIcon?: ReactNode;
  messageText?: ReactNode;
  messageTextIsAlwaysFullSize?: boolean;
  onClick?: () => void;
  onMouseDown?: () => void;
  shouldShowSpinner?: boolean;
  unreadCount?: number;
  unreadMentionsCount?: number;
  avatarSize?: AvatarSize;
  testId?: string;
  renderConversationListItemContextMenu?: (
    props: RenderConversationListItemContextMenuProps
  ) => JSX.Element;
} & Pick<
  ConversationType,
  | 'avatarPlaceholderGradient'
  | 'avatarUrl'
  | 'color'
  | 'groupId'
  | 'hasAvatar'
  | 'isMe'
  | 'markedUnread'
  | 'phoneNumber'
  | 'profileName'
  | 'sharedGroupNames'
  | 'title'
  | 'serviceId'
> &
  (
    | { badge?: undefined; theme?: ThemeType }
    | { badge: BadgeType; theme: ThemeType }
  );

export const BaseConversationListItem: FunctionComponent<PropsType> =
  React.memo(function BaseConversationListItem(props) {
    const {
      avatarPlaceholderGradient,
      avatarUrl,
      avatarSize,
      buttonAriaLabel,
      checked,
      color,
      conversationType,
      disabled,
      groupId,
      hasAvatar,
      headerDate,
      headerName,
      i18n,
      id,
      isMe,
      isNoteToSelf,
      isUsernameSearchResult,
      isSelected,
      markedUnread,
      messageStatusIcon,
      messageText,
      messageTextIsAlwaysFullSize,
      onClick,
      onMouseDown,
      phoneNumber,
      profileName,
      sharedGroupNames,
      shouldShowSpinner,
      testId: overrideTestId,
      title,
      unreadCount,
      unreadMentionsCount,
      serviceId,
      renderConversationListItemContextMenu,
    } = props;

    const identifier = id ? cleanId(id) : undefined;
    const htmlId = useMemo(() => generateUuid(), []);
    const testId = overrideTestId || groupId || serviceId;
    const isUnread = isConversationUnread({ markedUnread, unreadCount });

    const isAvatarNoteToSelf = isBoolean(isNoteToSelf)
      ? isNoteToSelf
      : Boolean(isMe);

    const isCheckbox = isBoolean(checked);

    let actionNode: ReactNode;
    if (shouldShowSpinner) {
      actionNode = (
        <Spinner
          size="20px"
          svgSize="small"
          moduleClassName={SPINNER_CLASS_NAME}
          direction="on-progress-dialog"
        />
      );
    } else if (isCheckbox) {
      let ariaLabel: string;
      if (disabled) {
        ariaLabel = i18n('icu:cannotSelectContact', {
          name: title,
        });
      } else if (checked) {
        ariaLabel = i18n('icu:deselectContact', {
          name: title,
        });
      } else {
        ariaLabel = i18n('icu:selectContact', {
          name: title,
        });
      }
      actionNode = (
        <div className={CHECKBOX_CONTAINER_CLASS_NAME}>
          <input
            aria-label={ariaLabel}
            checked={checked}
            className={CHECKBOX_CLASS_NAME}
            disabled={disabled}
            id={htmlId}
            onChange={onClick}
            onKeyDown={event => {
              if (onClick && !disabled && event.key === 'Enter') {
                onClick();
              }
            }}
            type="checkbox"
          />
        </div>
      );
    }

    const unreadIndicators = (() => {
      if (!isUnread) {
        return null;
      }
      return (
        <div className={`${CONTENT_CLASS_NAME}__unread-indicators`}>
          {unreadMentionsCount ? (
            <UnreadIndicator variant={UnreadIndicatorVariant.UNREAD_MENTIONS} />
          ) : null}
          {unreadCount ? (
            <UnreadIndicator
              variant={UnreadIndicatorVariant.UNREAD_MESSAGES}
              count={unreadCount}
            />
          ) : (
            <UnreadIndicator variant={UnreadIndicatorVariant.MARKED_UNREAD} />
          )}
        </div>
      );
    })();

    const contents = (
      <>
        <div className={AVATAR_CONTAINER_CLASS_NAME}>
          <Avatar
            avatarPlaceholderGradient={avatarPlaceholderGradient}
            avatarUrl={avatarUrl}
            color={color}
            conversationType={conversationType}
            hasAvatar={hasAvatar}
            noteToSelf={isAvatarNoteToSelf}
            searchResult={isUsernameSearchResult}
            i18n={i18n}
            phoneNumber={phoneNumber}
            profileName={profileName}
            title={title}
            sharedGroupNames={sharedGroupNames}
            size={avatarSize ?? AvatarSize.FORTY_EIGHT}
            // This is here to appease the type checker.
            {...(props.badge
              ? { badge: props.badge, theme: props.theme }
              : { badge: undefined })}
          />
          {unreadIndicators}
        </div>
        <div
          className={classNames(
            CONTENT_CLASS_NAME,
            disabled && `${CONTENT_CLASS_NAME}--disabled`
          )}
        >
          <div aria-live="off" className={HEADER_CLASS_NAME}>
            <div className={`${HEADER_CLASS_NAME}__name`}>{headerName}</div>
            <Timestamp timestamp={headerDate} i18n={i18n} />
          </div>
          {messageText || isUnread ? (
            <div className={MESSAGE_CLASS_NAME}>
              {Boolean(messageText) && (
                <div
                  dir="auto"
                  className={classNames(
                    MESSAGE_TEXT_CLASS_NAME,
                    messageTextIsAlwaysFullSize &&
                      `${MESSAGE_TEXT_CLASS_NAME}--always-full-size`
                  )}
                >
                  {messageText}
                </div>
              )}
              {messageStatusIcon}
              {unreadIndicators}
            </div>
          ) : null}
        </div>
        {actionNode}
      </>
    );

    const commonClassNames = classNames(BASE_CLASS_NAME, {
      [`${BASE_CLASS_NAME}--is-selected`]: isSelected,
    });

    if (isCheckbox) {
      return (
        <label
          className={classNames(
            commonClassNames,
            `${BASE_CLASS_NAME}--is-checkbox`,
            { [`${BASE_CLASS_NAME}--disabled`]: disabled }
          )}
          data-id={identifier}
          data-testid={testId}
          htmlFor={htmlId}
          // `onClick` is will double-fire if we're enabled. We want it to fire when we're
          //   disabled so we can show any "can't add contact" modals, etc. This won't
          //   work for keyboard users, though, because labels are not tabbable.
          {...(disabled ? { onClick } : {})}
        >
          {contents}
        </label>
      );
    }

    let wrapper: JSX.Element;

    if (onClick) {
      wrapper = (
        <button
          aria-label={
            buttonAriaLabel ||
            i18n('icu:BaseConversationListItem__aria-label', {
              title,
            })
          }
          className={classNames(
            commonClassNames,
            `${BASE_CLASS_NAME}--is-button`
          )}
          data-id={identifier}
          data-testid={testId}
          disabled={disabled}
          onClick={onClick}
          onMouseDown={onMouseDown}
          type="button"
        >
          {contents}
        </button>
      );
    } else {
      wrapper = (
        <div
          className={commonClassNames}
          data-id={identifier}
          data-testid={testId}
        >
          {contents}
        </div>
      );
    }

    if (renderConversationListItemContextMenu != null && id != null) {
      return renderConversationListItemContextMenu({
        conversationId: id,
        children: wrapper,
      });
    }

    return wrapper;
  });

function Timestamp({
  i18n,
  timestamp,
}: Readonly<{ i18n: LocalizerType; timestamp?: number }>) {
  const getText = useCallback(
    () => (isNumber(timestamp) ? formatDateTimeShort(i18n, timestamp) : ''),
    [i18n, timestamp]
  );

  const [text, setText] = useState(getText());

  useEffect(() => {
    const update = () => setText(getText());
    update();
    const interval = setInterval(update, durations.MINUTE);
    return () => {
      clearInterval(interval);
    };
  }, [getText]);

  if (!isNumber(timestamp)) {
    return null;
  }

  return (
    <Time className={DATE_CLASS_NAME} timestamp={timestamp}>
      {text}
    </Time>
  );
}

enum UnreadIndicatorVariant {
  MARKED_UNREAD = 'marked-unread',
  UNREAD_MESSAGES = 'unread-messages',
  UNREAD_MENTIONS = 'unread-mentions',
}

type UnreadIndicatorPropsType =
  | {
      variant: UnreadIndicatorVariant.MARKED_UNREAD;
    }
  | {
      variant: UnreadIndicatorVariant.UNREAD_MESSAGES;
      count: number;
    }
  | { variant: UnreadIndicatorVariant.UNREAD_MENTIONS };

function UnreadIndicator(props: UnreadIndicatorPropsType) {
  let content: React.ReactNode;

  switch (props.variant) {
    case UnreadIndicatorVariant.MARKED_UNREAD:
      content = null;
      break;
    case UnreadIndicatorVariant.UNREAD_MESSAGES:
      content = props.count > 0 && props.count;
      break;
    case UnreadIndicatorVariant.UNREAD_MENTIONS:
      content = (
        <div
          className={classNames(
            `${BASE_CLASS_NAME}__unread-indicator--${props.variant}__icon`
          )}
        />
      );
      break;
    default:
      throw new Error('Unexpected variant');
  }

  return (
    <div
      className={classNames(
        `${BASE_CLASS_NAME}__unread-indicator`,
        `${BASE_CLASS_NAME}__unread-indicator--${props.variant}`
      )}
    >
      {content}
    </div>
  );
}
