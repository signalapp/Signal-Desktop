// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';
import { bemGenerator } from './util';

export type Props = {
  alwaysShowActions?: boolean;
  className?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  label: string | React.ReactNode;
  info?: string;
  right?: string | React.ReactNode;
  actions?: React.ReactNode;
  onClick?: () => void;
};

const bem = bemGenerator('module-conversation-details-panel-row');

export const PanelRow: React.ComponentType<Props> = ({
  alwaysShowActions,
  className,
  disabled,
  icon,
  label,
  info,
  right,
  actions,
  onClick,
}) => {
  const content = (
    <>
      {icon !== undefined ? <div className={bem('icon')}>{icon}</div> : null}
      <div className={bem('label')}>
        <div>{label}</div>
        {info !== undefined ? <div className={bem('info')}>{info}</div> : null}
      </div>
      {right !== undefined ? <div className={bem('right')}>{right}</div> : null}
      {actions !== undefined ? (
        <div className={alwaysShowActions ? '' : bem('actions')}>{actions}</div>
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button
        disabled={disabled}
        type="button"
        className={classNames(bem('root', 'button'), className)}
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

  return <div className={classNames(bem('root'), className)}>{content}</div>;
};
