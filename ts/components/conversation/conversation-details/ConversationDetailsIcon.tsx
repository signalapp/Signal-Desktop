// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';

import { bemGenerator } from './util';

export type Props = {
  ariaLabel: string;
  disabled?: boolean;
  icon: string;
  onClick?: () => void;
};

const bem = bemGenerator('module-conversation-details-icon');

export const ConversationDetailsIcon: React.ComponentType<Props> = ({
  ariaLabel,
  disabled,
  icon,
  onClick,
}) => {
  const iconClassName = bem('icon', icon);
  const content = (
    <div
      className={classNames(
        iconClassName,
        disabled && `${iconClassName}--disabled`
      )}
    />
  );

  if (onClick) {
    return (
      <button
        aria-label={ariaLabel}
        className={bem('button')}
        disabled={disabled}
        type="button"
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

  return content;
};
