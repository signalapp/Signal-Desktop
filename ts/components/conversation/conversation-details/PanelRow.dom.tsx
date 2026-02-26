// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useId } from 'react';
import classNames from 'classnames';
import { bemGenerator } from './util.std.js';
import { AriaClickable } from '../../../axo/AriaClickable.dom.js';

export type Props = {
  alwaysShowActions?: boolean;
  className?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  label: string | React.ReactNode;
  info?: string | React.ReactNode;
  right?: string | React.ReactNode;
  actions?: React.ReactNode;
  onClick?: () => void;
};

const bem = bemGenerator('ConversationDetails-panel-row');

export function PanelRow({
  alwaysShowActions,
  className,
  disabled,
  icon,
  label,
  info,
  right,
  actions,
  onClick,
}: Props): React.ReactNode {
  const labelId = useId();
  const subWidget =
    actions !== undefined ? (
      <div className={alwaysShowActions ? '' : bem('actions')}>{actions}</div>
    ) : null;

  const content = (
    <>
      {icon !== undefined ? <div className={bem('icon')}>{icon}</div> : null}
      <div className={bem('label')}>
        <div id={labelId}>{label}</div>
        {info !== undefined ? <div className={bem('info')}>{info}</div> : null}
      </div>
      {right !== undefined ? <div className={bem('right')}>{right}</div> : null}
    </>
  );

  if (onClick) {
    return (
      <AriaClickable.Root
        className={classNames(bem('root', 'button'), className)}
      >
        {!disabled && (
          <AriaClickable.HiddenTrigger
            onClick={onClick}
            aria-labelledby={labelId}
          />
        )}
        <div className={bem('inner')}>
          {content}
          {subWidget && (
            <AriaClickable.SubWidget>{subWidget}</AriaClickable.SubWidget>
          )}
        </div>
      </AriaClickable.Root>
    );
  }

  return (
    <div className={classNames(bem('root'), className)}>
      <div className={bem('inner')}>
        {content}
        {subWidget}
      </div>
    </div>
  );
}
