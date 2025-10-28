// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactChild, ReactNode } from 'react';
import React from 'react';
import classNames from 'classnames';
import { Tooltip, TooltipPlacement } from './Tooltip.dom.js';
import { WidthBreakpoint } from './_util.std.js';

const BASE_CLASS_NAME = 'LeftPaneDialog';
const TOOLTIP_CLASS_NAME = `${BASE_CLASS_NAME}__tooltip`;
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
  const onClickWrap = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    onClick?.();
  };

  const onKeyDownWrap = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    onClick?.();
  };

  const onCloseWrap = (e: React.MouseEvent) => {
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
        className={`${BASE_CLASS_NAME}__action-text`}
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
      <div className={`${BASE_CLASS_NAME}__container-close`}>
        <button
          title={closeLabel}
          aria-label={closeLabel}
          className={`${BASE_CLASS_NAME}__close-button`}
          onClick={onCloseWrap}
          tabIndex={0}
          type="button"
        />
      </div>
    );
  }

  const className = classNames(BASE_CLASS_NAME, {
    [`${BASE_CLASS_NAME}--width-narrow`]:
      containerWidthBreakpoint === WidthBreakpoint.Narrow,
    [`${BASE_CLASS_NAME}--${type}`]: type != null,
    [`${BASE_CLASS_NAME}--clickable`]: onClick != null,
  });

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
      <div className={`${BASE_CLASS_NAME}__container`}>
        {icon ? (
          <div className={`${BASE_CLASS_NAME}__icon-container`}>
            {typeof icon === 'string' ? (
              <LeftPaneDialogIcon type={icon} />
            ) : (
              icon
            )}
          </div>
        ) : null}
        {containerWidthBreakpoint !== WidthBreakpoint.Narrow && (
          <div className={`${BASE_CLASS_NAME}__message`}>{message}</div>
        )}
      </div>
      {xButton}
    </>
  );

  let dialogNode: ReactChild;
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
          TOOLTIP_CLASS_NAME,
          type && `${TOOLTIP_CLASS_NAME}--${type}`
        )}
      >
        {dialogNode}
      </Tooltip>
    );
  }

  return dialogNode;
}

export function LeftPaneDialogIcon({
  type,
}: {
  type?: 'update' | 'relink' | 'network' | 'warning' | 'error';
}): JSX.Element {
  const iconClassName = classNames([
    `${BASE_CLASS_NAME}__icon`,
    `${BASE_CLASS_NAME}__icon--${type}`,
  ]);
  return <div className={iconClassName} />;
}

export function LeftPaneDialogIconBackground({
  type,
  children,
}: {
  type?: 'warning';
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div
      className={`${BASE_CLASS_NAME}__icon-background ${BASE_CLASS_NAME}__icon-background--${type}`}
    >
      {children}
    </div>
  );
}
