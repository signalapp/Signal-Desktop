// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React from 'react';

import type { LocalizerType } from '../../types/Util';

const CLASS_NAME = 'module-TimelineWarning';
const ICON_CONTAINER_CLASS_NAME = `${CLASS_NAME}__icon-container`;
const GENERIC_ICON_CLASS_NAME = `${CLASS_NAME}__generic-icon`;
const TEXT_CLASS_NAME = `${CLASS_NAME}__text`;
const LINK_CLASS_NAME = `${TEXT_CLASS_NAME}__link`;
const CLOSE_BUTTON_CLASS_NAME = `${CLASS_NAME}__close-button`;

type PropsType = {
  children: ReactNode;
  i18n: LocalizerType;
  onClose: () => void;
};

export function TimelineWarning({
  children,
  i18n,
  onClose,
}: Readonly<PropsType>): JSX.Element {
  return (
    <div className={CLASS_NAME}>
      {children}
      <button
        aria-label={i18n('close')}
        className={CLOSE_BUTTON_CLASS_NAME}
        onClick={onClose}
        type="button"
      />
    </div>
  );
}

TimelineWarning.IconContainer = ({
  children,
}: Readonly<{ children: ReactNode }>): JSX.Element => (
  <div className={ICON_CONTAINER_CLASS_NAME}>{children}</div>
);

TimelineWarning.GenericIcon = () => <div className={GENERIC_ICON_CLASS_NAME} />;

TimelineWarning.Text = ({
  children,
}: Readonly<{ children: ReactNode }>): JSX.Element => (
  <div className={TEXT_CLASS_NAME}>{children}</div>
);

type LinkProps = {
  children: ReactNode;
  onClick: () => void;
};

TimelineWarning.Link = ({
  children,
  onClick,
}: Readonly<LinkProps>): JSX.Element => (
  <button className={LINK_CLASS_NAME} onClick={onClick} type="button">
    {children}
  </button>
);
