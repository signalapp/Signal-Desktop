// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { LocalizerType } from '../../types/Util';

export type Props = {
  unreadCount?: number;
  conversationId: string;

  scrollDown: (conversationId: string) => void;

  i18n: LocalizerType;
};

export const ScrollDownButton = ({
  conversationId,
  unreadCount,
  i18n,
  scrollDown,
}: Props): JSX.Element => {
  const altText = unreadCount ? i18n('messagesBelow') : i18n('scrollDown');

  let badgeText: string | undefined;
  if (unreadCount) {
    if (unreadCount < 100) {
      badgeText = unreadCount.toString();
    } else {
      badgeText = '99+';
    }
  }

  return (
    <div className="ScrollDownButton">
      <button
        type="button"
        className="ScrollDownButton__button"
        onClick={() => {
          scrollDown(conversationId);
        }}
        title={altText}
      >
        {badgeText ? (
          <div className="ScrollDownButton__button__badge">{badgeText}</div>
        ) : null}
        <div className="ScrollDownButton__button__icon" />
      </button>
    </div>
  );
};
