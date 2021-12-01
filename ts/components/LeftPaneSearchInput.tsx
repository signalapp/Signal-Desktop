// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FocusEventHandler } from 'react';
import React, { forwardRef, useRef } from 'react';
import classNames from 'classnames';
import { refMerger } from '../util/refMerger';
import type { ConversationType } from '../state/ducks/conversations';
import type { LocalizerType } from '../types/Util';
import { Avatar, AvatarSize } from './Avatar';

type PropsType = {
  disabled?: boolean;
  i18n: LocalizerType;
  onBlur?: FocusEventHandler<HTMLInputElement>;
  onChangeValue: (newValue: string) => unknown;
  onClear: () => unknown;
  searchConversation?: ConversationType;
  value: string;
};

export const LeftPaneSearchInput = forwardRef<HTMLInputElement, PropsType>(
  (
    {
      disabled,
      i18n,
      onBlur,
      onChangeValue,
      onClear,
      searchConversation,
      value,
    },
    outerRef
  ) => {
    const inputRef = useRef<null | HTMLInputElement>(null);

    const emptyOrClear =
      searchConversation && value ? () => onChangeValue('') : onClear;

    const label = i18n(searchConversation ? 'searchIn' : 'search');

    return (
      <div className="LeftPaneSearchInput">
        {searchConversation ? (
          // Clicking the non-X part of the pill should focus the input but have a normal
          //   cursor. This effectively simulates `pointer-events: none` while still
          //   letting us change the cursor.
          // eslint-disable-next-line max-len
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
          <div
            className="LeftPaneSearchInput__in-conversation-pill"
            onClick={() => {
              inputRef.current?.focus();
            }}
          >
            <Avatar
              acceptedMessageRequest={searchConversation.acceptedMessageRequest}
              avatarPath={searchConversation.avatarPath}
              badge={undefined}
              color={searchConversation.color}
              conversationType={searchConversation.type}
              i18n={i18n}
              isMe={searchConversation.isMe}
              noteToSelf={searchConversation.isMe}
              sharedGroupNames={searchConversation.sharedGroupNames}
              size={AvatarSize.SIXTEEN}
              title={searchConversation.title}
              unblurredAvatarPath={searchConversation.unblurredAvatarPath}
            />
            <button
              aria-label={i18n('clearSearch')}
              className="LeftPaneSearchInput__in-conversation-pill__x-button"
              onClick={onClear}
              type="button"
            />
          </div>
        ) : (
          <div className="LeftPaneSearchInput__icon" />
        )}
        <input
          aria-label={label}
          className={classNames(
            'LeftPaneSearchInput__input',
            value && 'LeftPaneSearchInput__input--with-text',
            searchConversation && 'LeftPaneSearchInput__input--in-conversation'
          )}
          dir="auto"
          disabled={disabled}
          onBlur={onBlur}
          onChange={event => {
            onChangeValue(event.currentTarget.value);
          }}
          onKeyDown={event => {
            const { ctrlKey, key } = event;

            // On Linux, this key combo selects all text.
            if (window.platform === 'linux' && ctrlKey && key === '/') {
              event.preventDefault();
              event.stopPropagation();
            } else if (key === 'Escape') {
              emptyOrClear();
              event.preventDefault();
              event.stopPropagation();
            }
          }}
          placeholder={label}
          ref={refMerger(inputRef, outerRef)}
          value={value}
        />
        {value && (
          <button
            aria-label={i18n('cancel')}
            className="LeftPaneSearchInput__cancel"
            onClick={emptyOrClear}
            tabIndex={-1}
            type="button"
          />
        )}
      </div>
    );
  }
);
