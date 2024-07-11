// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';

export type PropsType = {
  avatarUrl?: string;
  children?: React.ReactNode;
  className?: string;
};

export function CallBackgroundBlur({
  avatarUrl,
  children,
  className,
}: PropsType): JSX.Element {
  return (
    <div
      className={classNames(
        'module-calling__background',
        !avatarUrl && 'module-calling__background--no-avatar',
        className
      )}
    >
      {avatarUrl && (
        <div
          className="module-calling__background--blur"
          style={{
            backgroundImage: `url('${avatarUrl}')`,
          }}
        />
      )}
      {children}
    </div>
  );
}
