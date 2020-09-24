import React from 'react';

import { LocalizerType } from '../../types/Util';

export type Props = {
  count: number;
  i18n: LocalizerType;
};

export const LastSeenIndicator = ({ count, i18n }: Props): JSX.Element => {
  const message =
    count === 1
      ? i18n('unreadMessage')
      : i18n('unreadMessages', [String(count)]);

  return (
    <div className="module-last-seen-indicator">
      <div className="module-last-seen-indicator__bar" />
      <div className="module-last-seen-indicator__text">{message}</div>
    </div>
  );
};
