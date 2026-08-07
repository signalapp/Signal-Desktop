// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FC } from 'react';
import { memo } from 'react';
import { AxoTooltip } from './AxoTooltip.dom.tsx';
import { useAxoIntl } from './_internal/AxoIntl.dom.tsx';
import { tw } from './tw.dom.tsx';
import { AxoSymbol } from './AxoSymbol.dom.tsx';

export namespace AxoContactName {
  /**
   * <AxoContactName.SystemContactEmblem>
   * ------------------------------------
   */

  export const SystemContactEmblem: FC = memo(() => {
    const intl = useAxoIntl();
    const label = intl.get('AxoContactName.InSystemContactsLabel');
    return (
      <AxoTooltip.Root
        label={label}
        delay="none"
        tooltipRepeatsTriggerAccessibleName
        keepOpenOnActivation
      >
        <button
          type="button"
          aria-label={label}
          className={tw(
            'inline-flex',
            'size-fit',
            'rounded-full',
            'leading-none',
            'focus:outline-none keyboard-mode:focus:axo-focus-ring'
          )}
        >
          <AxoSymbol.InlineGlyph label={null} symbol="person-circle" />
        </button>
      </AxoTooltip.Root>
    );
  });

  SystemContactEmblem.displayName = 'AxoContactName.SystemContactEmblem';
}
