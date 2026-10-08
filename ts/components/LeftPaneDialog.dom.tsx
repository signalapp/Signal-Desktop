// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode, JSX, MouseEvent, KeyboardEvent } from 'react';
import classNames from 'classnames';
import { Tooltip, TooltipPlacement } from './Tooltip.dom.tsx';
import { WidthBreakpoint } from './_util.std.ts';

export type DismissOptions =
  | {
      onClose?: undefined;
      closeLabel?: undefined;
      hasXButton?: false;
    }
  | {
      onClose: () => void;
      closeLabel: string;
      hasXButton: true;
    };

type DialogType = 'warning' | 'error' | 'info';

const DialogTypes: Record<DialogType, string> = {
  warning: 'LeftPaneDialog--warning',
  error: 'LeftPaneDialog--error',
  info: 'LeftPaneDialog--info',
};

const DialogTypeTooltips: Record<DialogType, string> = {
  error: 'LeftPaneDialog__tooltip--error',
  warning: 'LeftPaneDialog__tooltip--warning',
  info: 'LeftPaneDialog__tooltip--info',
};

export type PropsType = {
  type?: 'warning' | 'error' | 'info';
  icon?: 'update' | 'relink' | 'network' | 'warning' | 'error' | JSX.Element;
  title?: string;
  subtitle?: string;
  children?: ReactNode;
  hoverText?: string;
  containerWidthBreakpoint: WidthBreakpoint;
} & (
  | {
      onClick?: undefined;
      clickLabel?: undefined;
      hasAction?: false;
    }
  | {
      onClick: () => void;
      clickLabel: string;
      hasAction: boolean;
    }
) &
  DismissOptions;

export function LeftPaneDialog({
  icon = 'warning',
  type,
  onClick,
  clickLabel,
  title,
  subtitle,
  children,
  hoverText,
  hasAction,

  containerWidthBreakpoint,
  hasXButton,
  onClose,
  closeLabel,
}: PropsType): JSX.Element {
  const onClickWrap = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    onClick?.();
  };

  const onKeyDownWrap = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    onClick?.();
  };

  const onCloseWrap = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    onClose?.();
  };

  let action: ReactNode;
  if (hasAction) {
    action = (
      <button
        title={clickLabel}
        aria-label={clickLabel}
        className="LeftPaneDialog__action-text"
        onClick={onClickWrap}
        tabIndex={0}
        type="button"
      >
        {clickLabel}
      </button>
    );
  }

  let xButton: ReactNode;
  if (hasXButton && containerWidthBreakpoint !== WidthBreakpoint.Narrow) {
    xButton = (
      <div className="LeftPaneDialog__container-close">
        <button
          title={closeLabel}
          aria-label={closeLabel}
          className="LeftPaneDialog__close-button"
          onClick={onCloseWrap}
          tabIndex={0}
          type="button"
        />
      </div>
    );
  }

  const className = classNames(
    'LeftPaneDialog',
    type != null && DialogTypes[type],
    {
      'LeftPaneDialog--width-narrow':
        containerWidthBreakpoint === WidthBreakpoint.Narrow,
      'LeftPaneDialog--clickable': onClick != null,
    }
  );

  const message = (
    <>
      {title === undefined ? undefined : <h3>{title}</h3>}
      {subtitle === undefined ? undefined : <div>{subtitle}</div>}
      {children}
      {action}
    </>
  );
  const content = (
    <>
      <div className="LeftPaneDialog__container">
        {icon ? (
          <div className="LeftPaneDialog__icon-container">
            {typeof icon === 'string' ? (
              <LeftPaneDialogIcon type={icon} />
            ) : (
              icon
            )}
          </div>
        ) : null}
        {containerWidthBreakpoint !== WidthBreakpoint.Narrow && (
          <div className="LeftPaneDialog__message">{message}</div>
        )}
      </div>
      {xButton}
    </>
  );

  let dialogNode: ReactNode;
  if (onClick) {
    dialogNode = (
      <div
        className={className}
        role="button"
        onClick={onClickWrap}
        onKeyDown={onKeyDownWrap}
        aria-label={clickLabel}
        title={hoverText}
        tabIndex={0}
      >
        {content}
      </div>
    );
  } else {
    dialogNode = (
      <div className={className} title={hoverText}>
        {content}
      </div>
    );
  }

  if (containerWidthBreakpoint === WidthBreakpoint.Narrow) {
    return (
      <Tooltip
        content={message}
        direction={TooltipPlacement.Right}
        className={classNames(
          'LeftPaneDialog__tooltip',
          type != null && DialogTypeTooltips[type]
        )}
      >
        {dialogNode}
      </Tooltip>
    );
  }

  return dialogNode;
}

type DialogIconType = 'update' | 'relink' | 'network' | 'warning' | 'error';

const DialogIconTypes: Record<DialogIconType, string> = {
  update: 'LeftPaneDialog__icon--update',
  relink: 'LeftPaneDialog__icon--relink',
  network: 'LeftPaneDialog__icon--network',
  warning: 'LeftPaneDialog__icon--warning',
  error: 'LeftPaneDialog__icon--error',
};

export function LeftPaneDialogIcon({
  type,
}: {
  type?: DialogIconType;
}): JSX.Element {
  return (
    <div
      className={classNames(
        'LeftPaneDialog__icon',
        type != null && DialogIconTypes[type]
      )}
    />
  );
}

type IconBackgroundType = 'warning';

const IconBackgroundTypes: Record<IconBackgroundType, string> = {
  warning: 'LeftPaneDialog__icon-background--warning',
};

export function LeftPaneDialogIconBackground({
  type,
  children,
}: {
  type?: IconBackgroundType;
  children: ReactNode;
}): JSX.Element {
  return (
    <div
      className={classNames(
        'LeftPaneDialog__icon-background',
        type != null && IconBackgroundTypes[type]
      )}
    >
      {children}
    </div>
  );
}
