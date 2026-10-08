// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';

import classNames from 'classnames';

import type { LocalizerType } from '../../types/Util.std.ts';

export enum ScrollDownButtonVariant {
  UNREAD_MESSAGES = 'unread-messages',
  UNREAD_MENTIONS = 'unread-mentions',
}

const SCROLL_DOWN_BUTTON_VARIANTS: Record<ScrollDownButtonVariant, string> = {
  [ScrollDownButtonVariant.UNREAD_MESSAGES]:
    'ScrollDownButton__unread-messages',
  [ScrollDownButtonVariant.UNREAD_MENTIONS]:
    'ScrollDownButton__unread-mentions',
};

export type ScrollDownButtonPropsType = {
  variant: ScrollDownButtonVariant;
  count?: number;
  onClick: VoidFunction;
  i18n: LocalizerType;
};

export function ScrollDownButton({
  variant,
  count,
  onClick,
  i18n,
}: ScrollDownButtonPropsType): JSX.Element {
  let badgeText: string | undefined;
  if (count) {
    if (count < 100) {
      badgeText = count.toString();
    } else {
      badgeText = '99+';
    }
  }

  let altText: string;
  switch (variant) {
    case ScrollDownButtonVariant.UNREAD_MESSAGES:
      altText = count ? i18n('icu:messagesBelow') : i18n('icu:scrollDown');
      break;
    case ScrollDownButtonVariant.UNREAD_MENTIONS:
      altText = i18n('icu:mentionsBelow');
      break;
    default:
      throw new Error(`Unexpected variant: ${variant}`);
  }

  return (
    <button
      type="button"
      className={classNames(
        'ScrollDownButton',
        SCROLL_DOWN_BUTTON_VARIANTS[variant]
      )}
      onClick={onClick}
      title={altText}
    >
      {badgeText ? (
        <div className="ScrollDownButton__badge">{badgeText}</div>
      ) : null}
      <div className="ScrollDownButton__icon" />
    </button>
  );
}
