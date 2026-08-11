// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import { forwardRef } from 'react';
import classNames from 'classnames';
import { AxoSymbol } from '../../axo/AxoSymbol.dom.tsx';
import { tw } from '../../axo/tw.dom.tsx';
import { ExpireTimer } from './ExpireTimer.dom.tsx';
import { calculateExpirationTimestamp } from '../../util/expirationTimer.std.ts';
import { DurationInSeconds } from '../../util/durations/duration-in-seconds.std.ts';

export enum SystemMessageKind {
  Normal = 'Normal',
  Danger = 'Danger',
  Error = 'Error',
}

type SystemMessageBaseProps = {
  contents: ReactNode;
  button?: ReactNode;
  kind?: SystemMessageKind;
  expireTimer?: DurationInSeconds | null;
  expirationStartTimestamp?: number | null;
};

export type PropsType = SystemMessageBaseProps &
  (
    | {
        /** @deprecated Use symbol instead */
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
          | 'group-terminate'
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
        symbol?: never;
      }
    | {
        icon?: never;
        symbol: AxoSymbol.Name;
      }
  );

export const SystemMessage = forwardRef<HTMLDivElement, PropsType>(
  function SystemMessageInner(
    {
      icon,
      symbol,
      contents,
      button,
      kind = SystemMessageKind.Normal,
      expireTimer,
      expirationStartTimestamp,
    },
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
            icon && 'SystemMessage__contents--has-icon',
            icon && `SystemMessage__contents--icon-${icon}`
          )}
        >
          {symbol && (
            <span className={tw('me-2 inline-block')}>
              <AxoSymbol.Icon size={16} symbol={symbol} label={null} />
            </span>
          )}
          {contents}
          {expireTimer != null && expirationStartTimestamp != null && (
            <ExpireTimer
              expirationLength={DurationInSeconds.toMillis(expireTimer)}
              expirationTimestamp={calculateExpirationTimestamp({
                expireTimer,
                expirationStartTimestamp,
              })}
            />
          )}
        </div>
        {button && (
          <div className="SystemMessage__button-container">{button}</div>
        )}
      </div>
    );
  }
);
