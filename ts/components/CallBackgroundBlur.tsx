// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';
import type { AvatarColorType } from '../types/Colors';

export type PropsType = {
  avatarPath?: string;
  children?: React.ReactNode;
  className?: string;
  color?: AvatarColorType;
};

export const CallBackgroundBlur = ({
  avatarPath,
  children,
  className,
  color,
}: PropsType): JSX.Element => {
  return (
    <div
      className={classNames(
        'module-calling__background',
        {
          [`module-background-color__${color || 'default'}`]: !avatarPath,
        },
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
};
