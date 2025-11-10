// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React, { forwardRef } from 'react';
import classNames from 'classnames';
import { AxoSymbol } from '../../axo/AxoSymbol.dom.js';
import type { AxoSymbolIconName } from '../../axo/_internal/AxoSymbolDefs.generated.std.js';
import { tw } from '../../axo/tw.dom.js';

export enum SystemMessageKind {
  Normal = 'Normal',
  Danger = 'Danger',
  Error = 'Error',
}

type SystemMessageBaseProps = {
  contents: ReactNode;
  button?: ReactNode;
  kind?: SystemMessageKind;
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
        symbol: AxoSymbolIconName;
      }
  );

export const SystemMessage = forwardRef<HTMLDivElement, PropsType>(
  function SystemMessageInner(
    { icon, symbol, contents, button, kind = SystemMessageKind.Normal },
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
        </div>
        {button && (
          <div className="SystemMessage__button-container">{button}</div>
        )}
      </div>
    );
  }
);
