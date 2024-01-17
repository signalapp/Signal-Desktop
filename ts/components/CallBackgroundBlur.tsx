// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';

export type PropsType = {
  avatarPath?: string;
  children?: React.ReactNode;
  className?: string;
};

export function CallBackgroundBlur({
  avatarPath,
  children,
  className,
}: PropsType): JSX.Element {
  return (
    <div
      className={classNames(
        'module-calling__background',
        !avatarPath && 'module-calling__background--no-avatar',
        className
      )}
    >
      {avatarPath && (
        <div
          className="module-calling__background--blur"
          style={{
            backgroundImage: `url('${encodeURI(avatarPath)}')`,
          }}
        />
      )}
      {children}
    </div>
  );
}
