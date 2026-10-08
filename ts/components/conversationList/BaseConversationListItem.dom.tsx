// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode, FunctionComponent, JSX } from 'react';
import { useCallback, useEffect, useMemo, useState, memo } from 'react';
import classNames from 'classnames';
import lodash from 'lodash';
import { v4 as generateUuid } from 'uuid';

import { Avatar, AvatarSize } from '../Avatar.dom.tsx';
import type { BadgeType } from '../../badges/types.std.ts';
import { isConversationUnread } from '../../util/isConversationUnread.std.ts';
import { cleanId } from '../_util.std.ts';
import type { LocalizerType, ThemeType } from '../../types/Util.std.ts';
import type { ConversationType } from '../../state/ducks/conversations.preload.ts';
import { Spinner } from '../Spinner.dom.tsx';
import { Time } from '../Time.dom.tsx';
import { formatDateTimeShort } from '../../util/formatTimestamp.dom.ts';
import * as durations from '../../util/durations/index.std.ts';

const { isBoolean, isNumber } = lodash;

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
  | 'title'
  | 'serviceId'
> &
  (
    | { badge?: undefined; theme?: ThemeType }
    | { badge: BadgeType; theme: ThemeType }
  );

export const BaseConversationListItem: FunctionComponent<PropsType> = memo(
  function BaseConversationListItem(props) {
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

    const isAvatarNoteToSelf = isBoolean(isNoteToSelf) ? isNoteToSelf : isMe;

    const isCheckbox = isBoolean(checked);

    let actionNode: ReactNode;
    if (shouldShowSpinner) {
      actionNode = (
        <Spinner size="20px" svgSize="small" direction="on-progress-dialog" />
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
        <div className="module-conversation-list__item--contact-or-conversation__checkbox--container">
          <input
            aria-label={ariaLabel}
            checked={checked}
            className="module-conversation-list__item--contact-or-conversation__checkbox"
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
        <div className="module-conversation-list__item--contact-or-conversation__content__unread-indicators">
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
        <div className="module-conversation-list__item--contact-or-conversation__avatar-container">
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
            'module-conversation-list__item--contact-or-conversation__content',
            disabled &&
              'module-conversation-list__item--contact-or-conversation__content--disabled'
          )}
        >
          <div
            aria-live="off"
            className="module-conversation-list__item--contact-or-conversation__content__header"
          >
            <div className="module-conversation-list__item--contact-or-conversation__content__header__name">
              {headerName}
            </div>
            <Timestamp timestamp={headerDate} i18n={i18n} />
          </div>
          {messageText || isUnread ? (
            <div className="module-conversation-list__item--contact-or-conversation__content__message">
              {Boolean(messageText) && (
                <div
                  dir="auto"
                  className={classNames(
                    'module-conversation-list__item--contact-or-conversation__content__message__text',
                    messageTextIsAlwaysFullSize &&
                      'module-conversation-list__item--contact-or-conversation__content__message__text--always-full-size'
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

    const commonClassNames = classNames(
      'module-conversation-list__item--contact-or-conversation',
      {
        'module-conversation-list__item--contact-or-conversation--is-selected':
          isSelected,
      }
    );

    if (isCheckbox) {
      return (
        <label
          className={classNames(
            commonClassNames,
            'module-conversation-list__item--contact-or-conversation--is-checkbox',
            {
              'module-conversation-list__item--contact-or-conversation--disabled':
                disabled,
            }
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
            'module-conversation-list__item--contact-or-conversation--is-button'
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
  }
);

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
    <Time
      className="module-conversation-list__item--contact-or-conversation__content__header__date"
      timestamp={timestamp}
    >
      {text}
    </Time>
  );
}

enum UnreadIndicatorVariant {
  MARKED_UNREAD = 'marked-unread',
  UNREAD_MESSAGES = 'unread-messages',
  UNREAD_MENTIONS = 'unread-mentions',
}

const UNREAD_INDICATOR_VARIANTS: Record<UnreadIndicatorVariant, string> = {
  [UnreadIndicatorVariant.MARKED_UNREAD]:
    'module-conversation-list__item--contact-or-conversation__unread-indicator--marked-unread',
  [UnreadIndicatorVariant.UNREAD_MESSAGES]:
    'module-conversation-list__item--contact-or-conversation__unread-indicator--unread-messages',
  [UnreadIndicatorVariant.UNREAD_MENTIONS]:
    'module-conversation-list__item--contact-or-conversation__unread-indicator--unread-mentions',
};

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
  let content: ReactNode;

  switch (props.variant) {
    case UnreadIndicatorVariant.MARKED_UNREAD:
      content = null;
      break;
    case UnreadIndicatorVariant.UNREAD_MESSAGES:
      content = props.count > 0 && props.count;
      break;
    case UnreadIndicatorVariant.UNREAD_MENTIONS:
      content = (
        <div className="module-conversation-list__item--contact-or-conversation__unread-indicator--unread-mentions__icon" />
      );
      break;
    default:
      throw new Error('Unexpected variant');
  }

  return (
    <div
      className={classNames(
        'module-conversation-list__item--contact-or-conversation__unread-indicator',
        UNREAD_INDICATOR_VARIANTS[props.variant]
      )}
    >
      {content}
    </div>
  );
}
