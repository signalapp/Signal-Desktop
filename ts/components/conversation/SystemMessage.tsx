// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React, { forwardRef } from 'react';
import classNames from 'classnames';

type PropsType = {
  icon: string;
  contents: ReactNode;
  button?: ReactNode;
  isError?: boolean;
};

export const SystemMessage = forwardRef<HTMLDivElement, PropsType>(
  ({ icon, contents, button, isError }, ref) => {
    return (
      <div
        className={classNames(
          'SystemMessage',
          isError && 'SystemMessage--error'
        )}
        ref={ref}
      >
        <div
          className={classNames(
            'SystemMessage__contents',
            `SystemMessage__contents--icon-${icon}`
          )}
        >
          {contents}
        </div>
        {button && (
          <div className="SystemMessage__button-container">{button}</div>
        )}
      </div>
    );
  }
);
