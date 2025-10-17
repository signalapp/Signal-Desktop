// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import React from 'react';
import classNames from 'classnames';

import type { AvatarColorType } from '../types/Colors.std.js';
import type { LocalizerType } from '../types/Util.std.js';

export type PropsType = {
  children?: ReactNode;
  color?: AvatarColorType;
  i18n: LocalizerType;
  isSelected?: boolean;
  onDelete?: (ev: MouseEvent) => unknown;
  onSelect: () => unknown;
  style?: CSSProperties;
};

export function BetterAvatarBubble({
  children,
  color,
  i18n,
  isSelected,
  onDelete,
  onSelect,
  style,
}: PropsType): JSX.Element {
  return (
    <div
      className={classNames(
        {
          BetterAvatarBubble: true,
          'BetterAvatarBubble--selected': isSelected,
        },
        color && `BetterAvatarBubble--${color}`
      )}
      onKeyDown={ev => {
        if (ev.key === 'Enter') {
          onSelect();
        }
      }}
      onClick={onSelect}
      role="button"
      style={style}
      tabIndex={0}
    >
      {onDelete && (
        <button
          aria-label={i18n('icu:delete')}
          className="BetterAvatarBubble__delete"
          onClick={onDelete}
          tabIndex={-1}
          type="button"
        />
      )}
      {children}
    </div>
  );
}
