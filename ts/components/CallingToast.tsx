// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';

type PropsType = {
  isVisible: boolean;
  onClick: () => unknown;
  children?: JSX.Element | string;
};

export const DEFAULT_LIFETIME = 5000;

export function CallingToast({
  isVisible,
  onClick,
  children,
}: PropsType): JSX.Element {
  return (
    <button
      className={classNames(
        'CallingToast',
        !isVisible && 'CallingToast--hidden'
      )}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}
