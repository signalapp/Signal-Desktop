// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX, ReactNode, MouseEvent, KeyboardEvent } from 'react';

import classNames from 'classnames';

import { Spinner } from '../../Spinner.dom.tsx';
import { bemGenerator } from './util.std.ts';

export enum IconType {
  'edit' = 'edit',
  'reset' = 'reset',
  'share' = 'share',
  'spinner' = 'spinner',
  'trash' = 'trash',
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
  let content: ReactNode;

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
        onClick={(event: MouseEvent<HTMLDivElement>) => {
          event.preventDefault();
          event.stopPropagation();
          onClick();
        }}
        onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
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
        onClick={(event: MouseEvent<HTMLButtonElement>) => {
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
