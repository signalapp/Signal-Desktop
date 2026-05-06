// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';

import classNames from 'classnames';
import { AxoSymbol } from '../axo/AxoSymbol.dom.tsx';
import { tw } from '../axo/tw.dom.tsx';

export type PropsType = {
  isOnlyHandRaised: boolean;
  raisedHandOrder: number;
};

export function CallingStatusIndicatorHandRaised({
  isOnlyHandRaised,
  raisedHandOrder,
}: PropsType): JSX.Element {
  const isNext = isOnlyHandRaised || raisedHandOrder === 0;
  return (
    <div
      className={classNames(
        // oxlint-disable-next-line better-tailwindcss/no-restricted-classes
        tw('text-[rgba(0,0,0,0.90)]'),
        'CallingStatusIndicator',
        'CallingStatusIndicator--HandRaised',
        isNext && 'CallingStatusIndicator--NextHandRaised'
      )}
    >
      {!isOnlyHandRaised && (
        <div className="CallingStatusIndicator--HandRaisedOrder">
          {raisedHandOrder + 1}
        </div>
      )}
      <span className={tw('-ms-px -mbs-px')}>
        <AxoSymbol.Icon size={16} symbol="raisehand" label={null} />
      </span>
    </div>
  );
}
