// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';
import { ColorType } from '../types/Colors';

export type PropsType = {
  avatarPath?: string;
  children: React.ReactNode;
  color?: ColorType;
};

export const CallBackgroundBlur = ({
  avatarPath,
  children,
  color,
}: PropsType): JSX.Element => {
  return (
    <div
      className={classNames('module-calling__background', {
        [`module-background-color__${color || 'default'}`]: !avatarPath,
      })}
    >
      {avatarPath && (
        <div
          className="module-calling__background--blur"
          style={{
            backgroundImage: `url("${avatarPath}")`,
          }}
        />
      )}
      {children}
    </div>
  );
};
