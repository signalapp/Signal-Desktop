// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React, { forwardRef } from 'react';
import classNames from 'classnames';

export enum SystemMessageKind {
  Normal = 'Normal',
  Danger = 'Danger',
  Error = 'Error',
}

export type PropsType = {
  icon:
    | 'audio-incoming'
    | 'audio-missed'
    | 'audio-outgoing'
    | 'block'
    | 'group'
    | 'group-access'
    | 'group-add'
    | 'group-approved'
    | 'group-avatar'
    | 'group-decline'
    | 'group-edit'
    | 'group-leave'
    | 'group-remove'
    | 'group-summary'
    | 'info'
    | 'phone'
    | 'profile'
    | 'safety-number'
    | 'spam'
    | 'session-refresh'
    | 'thread'
    | 'timer'
    | 'timer-disabled'
    | 'unsupported'
    | 'unsupported--can-process'
    | 'verified'
    | 'verified-not'
    | 'video'
    | 'video-incoming'
    | 'video-missed'
    | 'video-outgoing'
    | 'warning'
    | 'payment-event'
    | 'merge';
  contents: ReactNode;
  button?: ReactNode;
  kind?: SystemMessageKind;
};

export const SystemMessage = forwardRef<HTMLDivElement, PropsType>(
  function SystemMessageInner(
    { icon, contents, button, kind = SystemMessageKind.Normal },
    ref
  ) {
    return (
      <div
        className={classNames(
          'SystemMessage',
          kind === SystemMessageKind.Danger && 'SystemMessage--danger',
          kind === SystemMessageKind.Error && 'SystemMessage--error'
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
