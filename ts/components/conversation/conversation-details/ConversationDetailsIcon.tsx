// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { bemGenerator } from './util';

export type Props = {
  ariaLabel: string;
  icon: string;
  onClick?: () => void;
};

const bem = bemGenerator('module-conversation-details-icon');

export const ConversationDetailsIcon: React.ComponentType<Props> = ({
  ariaLabel,
  icon,
  onClick,
}) => {
  const content = <div className={bem('icon', icon)} />;

  if (onClick) {
    return (
      <button
        aria-label={ariaLabel}
        className={bem('button')}
        type="button"
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

  return content;
};
