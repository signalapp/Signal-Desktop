// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode, FC } from 'react';
import { memo } from 'react';
import { tw } from '../tw.dom.tsx';
import { AxoSymbol } from '../AxoSymbol.dom.tsx';

export namespace Story {
  /**
   * <Story.Hint>
   * --------------------------------------------------------------------------
   */

  export type HintProps = Readonly<{
    children?: ReactNode;
  }>;

  export const Hint: FC<HintProps> = memo(props => {
    return (
      <p className={tw('type-caption text-secondary')}>{props.children}</p>
    );
  });

  Hint.displayName = 'Story.Hint';

  /**
   * <Story.Callout>
   * --------------------------------------------------------------------------
   */

  export type CalloutProps = Readonly<{
    children?: ReactNode;
  }>;

  export const Callout: FC<HintProps> = memo(props => {
    return (
      <div
        className={tw(
          'my-2 flex gap-2 p-2',
          'bg-warning-tint text-warning',
          'border border-dashed',
          'type-caption font-medium',
          'font-mono'
        )}
      >
        <AxoSymbol.InlineGlyph symbol="error-circle-fill" label={null} />
        <div className={tw('flex-1')}>{props.children}</div>
      </div>
    );
  });

  Callout.displayName = 'Story.Callout';

  /**
   * <Story.Legend>
   * --------------------------------------------------------------------------
   */

  export type LegendProps = Readonly<{
    label: string;
    children?: ReactNode;
  }>;

  export const Legend: FC<LegendProps> = memo(props => {
    return (
      <fieldset className={tw('my-2 border border-dashed border-selected p-2')}>
        <legend className={tw('px-2 font-mono type-caption text-accent')}>
          {props.label}
        </legend>
        {props.children}
      </fieldset>
    );
  });

  Legend.displayName = 'Story.Legend';
}
