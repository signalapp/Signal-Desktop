// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { ReactNode } from 'react';
import classNames from 'classnames';

const BASE_CLASS_NAME = 'LeftPaneDialog';

export type PropsType = {
  type?: 'warning' | 'error';
  icon?: 'update' | 'relink' | 'network' | ReactNode;
  title?: string;
  subtitle?: string;
  children?: ReactNode;
  hoverText?: string;
} & (
  | {
      onClick?: undefined;
      clickLabel?: undefined;
      hasAction?: false;
    }
  | {
      onClick: () => void;
      clickLabel: string;
      hasAction: true;
    }
) &
  (
    | {
        onClose?: undefined;
        closeLabel?: undefined;
        hasXButton?: false;
      }
    | {
        onClose: () => void;
        closeLabel: string;
        hasXButton: true;
      }
  );

export const LeftPaneDialog: React.FC<PropsType> = ({
  icon,
  type,
  onClick,
  clickLabel,
  title,
  subtitle,
  children,
  hoverText,
  hasAction,

  hasXButton,
  onClose,
  closeLabel,
}) => {
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

  const iconClassName =
    typeof icon === 'string'
      ? classNames([
          `${BASE_CLASS_NAME}__icon`,
          `${BASE_CLASS_NAME}__icon--${icon}`,
        ])
      : undefined;

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
  if (hasXButton) {
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

  const className = classNames([
    BASE_CLASS_NAME,
    type === undefined ? undefined : `${BASE_CLASS_NAME}--${type}`,
    onClick === undefined ? undefined : `${BASE_CLASS_NAME}--clickable`,
  ]);

  const content = (
    <>
      <div className={`${BASE_CLASS_NAME}__container`}>
        {typeof icon === 'string' ? <div className={iconClassName} /> : icon}
        <div className={`${BASE_CLASS_NAME}__message`}>
          {title === undefined ? undefined : <h3>{title}</h3>}
          {subtitle === undefined ? undefined : <div>{subtitle}</div>}
          {children}
          {action}
        </div>
      </div>
      {xButton}
    </>
  );

  if (onClick) {
    return (
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
  }

  return (
    <div className={className} title={hoverText}>
      {content}
    </div>
  );
};
