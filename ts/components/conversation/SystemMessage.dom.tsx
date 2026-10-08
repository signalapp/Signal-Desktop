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

/** @deprecated */
type Icon =
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

const IconClassNames: Record<Icon, string> = {
  'audio-incoming': 'SystemMessage__contents--icon-audio-incoming',
  'audio-missed': 'SystemMessage__contents--icon-audio-missed',
  'audio-outgoing': 'SystemMessage__contents--icon-audio-outgoing',
  block: 'SystemMessage__contents--icon-block',
  group: 'SystemMessage__contents--icon-group',
  'group-access': 'SystemMessage__contents--icon-group-access',
  'group-add': 'SystemMessage__contents--icon-group-add',
  'group-approved': 'SystemMessage__contents--icon-group-approved',
  'group-avatar': 'SystemMessage__contents--icon-group-avatar',
  'group-decline': 'SystemMessage__contents--icon-group-decline',
  'group-edit': 'SystemMessage__contents--icon-group-edit',
  'group-leave': 'SystemMessage__contents--icon-group-leave',
  'group-remove': 'SystemMessage__contents--icon-group-remove',
  'group-summary': 'SystemMessage__contents--icon-group-summary',
  'group-terminate': 'SystemMessage__contents--icon-group-terminate',
  info: 'SystemMessage__contents--icon-info',
  phone: 'SystemMessage__contents--icon-phone',
  profile: 'SystemMessage__contents--icon-profile',
  'safety-number': 'SystemMessage__contents--icon-safety-number',
  spam: 'SystemMessage__contents--icon-spam',
  'session-refresh': 'SystemMessage__contents--icon-session-refresh',
  thread: 'SystemMessage__contents--icon-thread',
  timer: 'SystemMessage__contents--icon-timer',
  'timer-disabled': 'SystemMessage__contents--icon-timer-disabled',
  unsupported: 'SystemMessage__contents--icon-unsupported',
  'unsupported--can-process':
    'SystemMessage__contents--icon-unsupported--can-process',
  verified: 'SystemMessage__contents--icon-verified',
  'verified-not': 'SystemMessage__contents--icon-verified-not',
  video: 'SystemMessage__contents--icon-video',
  'video-incoming': 'SystemMessage__contents--icon-video-incoming',
  'video-missed': 'SystemMessage__contents--icon-video-missed',
  'video-outgoing': 'SystemMessage__contents--icon-video-outgoing',
  warning: 'SystemMessage__contents--icon-warning',
  'payment-event': 'SystemMessage__contents--icon-payment-event',
  merge: 'SystemMessage__contents--icon-merge',
};

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
        icon: Icon;
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
            icon && IconClassNames[icon]
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
