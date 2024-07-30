// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';

import { Spinner } from '../../Spinner';
import { bemGenerator } from './util';

export enum IconType {
  'approveAllMembers' = 'approveAllMembers',
  'block' = 'block',
  'edit' = 'edit',
  'unblock' = 'unblock',
  'color' = 'color',
  'down' = 'down',
  'forward' = 'forward',
  'invites' = 'invites',
  'leave' = 'leave',
  'link' = 'link',
  'lock' = 'lock',
  'mention' = 'mention',
  'mute' = 'mute',
  'notifications' = 'notifications',
  'reset' = 'reset',
  'share' = 'share',
  'spinner' = 'spinner',
  'timer' = 'timer',
  'trash' = 'trash',
  'verify' = 'verify',
}

export type Props = {
  ariaLabel: string;
  disabled?: boolean;
  icon: IconType;
  fakeButton?: boolean;
  onClick?: () => void;
};

const bem = bemGenerator('ConversationDetails-icon');

export function ConversationDetailsIcon({
  ariaLabel,
  disabled,
  icon,
  fakeButton,
  onClick,
}: Props): JSX.Element {
  let content: React.ReactChild;

  if (icon === IconType.spinner) {
    content = <Spinner svgSize="small" size="24" />;
  } else {
    const iconClassName = bem('icon', icon);
    content = (
      <div
        className={classNames(
          iconClassName,
          disabled && `${iconClassName}--disabled`
        )}
      />
    );
  }

  // We need this because sometimes this component is inside other buttons
  if (onClick && fakeButton && !disabled) {
    return (
      <div
        aria-label={ariaLabel}
        role="button"
        className={bem('button')}
        tabIndex={0}
        onClick={(event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
          event.preventDefault();
          event.stopPropagation();
          onClick();
        }}
        onKeyDown={(event: React.KeyboardEvent<HTMLDivElement>) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            onClick();
          }
        }}
      >
        {content}
      </div>
    );
  }

  if (onClick) {
    return (
      <button
        aria-label={ariaLabel}
        className={bem('button')}
        disabled={disabled}
        type="button"
        onClick={(event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
          event.preventDefault();
          event.stopPropagation();
          onClick();
        }}
      >
        {content}
      </button>
    );
  }

  return content;
}
