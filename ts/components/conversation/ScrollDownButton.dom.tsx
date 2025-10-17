// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import classNames from 'classnames';
import React from 'react';

import type { LocalizerType } from '../../types/Util.std.js';
import { getClassNamesFor } from '../../util/getClassNamesFor.std.js';

export enum ScrollDownButtonVariant {
  UNREAD_MESSAGES = 'unread-messages',
  UNREAD_MENTIONS = 'unread-mentions',
}

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
  const getClassName = getClassNamesFor('ScrollDownButton');

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
      className={classNames(getClassName(''), getClassName(`__${variant}`))}
      onClick={onClick}
      title={altText}
    >
      {badgeText ? (
        <div className={getClassName('__badge')}>{badgeText}</div>
      ) : null}
      <div
        className={classNames(
          getClassName('__icon'),
          getClassName(`__icon--${variant}`)
        )}
      />
    </button>
  );
}
