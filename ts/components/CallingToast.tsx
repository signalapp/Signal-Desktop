// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FunctionComponent } from 'react';
import React from 'react';
import classNames from 'classnames';

type PropsType = {
  isVisible: boolean;
  onClick: () => unknown;
};

export const DEFAULT_LIFETIME = 5000;

export const CallingToast: FunctionComponent<PropsType> = ({
  isVisible,
  onClick,
  children,
}) => (
  <button
    className={classNames('CallingToast', !isVisible && 'CallingToast--hidden')}
    type="button"
    onClick={onClick}
  >
    {children}
  </button>
);
