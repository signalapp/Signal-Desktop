// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { FC } from 'react';
import React, { memo, useMemo } from 'react';
import { Direction } from 'radix-ui';
import { VisuallyHidden } from 'react-aria';
import type { TailwindStyles } from './tw.dom.js';
import { tw } from './tw.dom.js';
import {
  getAxoSymbolIcon,
  getAxoSymbolInlineGlyph,
} from './_internal/AxoSymbolDefs.generated.std.js';
import type {
  AxoSymbolIconName,
  AxoSymbolInlineGlyphName,
} from './_internal/AxoSymbolDefs.generated.std.js';

const { useDirection } = Direction;

const Namespace = 'AxoSymbol';

export namespace AxoSymbol {
  const symbolStyles = tw('font-symbols select-none');
  const labelStyles = tw('select-none');
  export type Weight = 300 | 400 | 700;
  const WeightStyles = {
    300: tw('font-light'),
    400: tw(),
    700: tw('font-semibold'),
  } as const satisfies Record<Weight, TailwindStyles>;

  function useRenderSymbol(
    glyph: string,
    label: string | null,
    weight: Weight
  ): React.JSX.Element {
    return useMemo(() => {
      return (
        <>
          <span aria-hidden className={tw(symbolStyles, WeightStyles[weight])}>
            {glyph}
          </span>
          {label != null && (
            <VisuallyHidden className={labelStyles}>{label}</VisuallyHidden>
          )}
        </>
      );
    }, [glyph, label, weight]);
  }

  /**
   * Component: <AxoSymbol.InlineGlyph>
   * --------------------------------------
   */

  export type InlineGlyphName = AxoSymbolInlineGlyphName;

  export type InlineGlyphProps = Readonly<{
    symbol: InlineGlyphName;
    label: string | null;
  }>;

  export const InlineGlyph: FC<InlineGlyphProps> = memo(props => {
    const direction = useDirection();
    const glyph = getAxoSymbolInlineGlyph(props.symbol, direction);
    const content = useRenderSymbol(glyph, props.label, 400);
    return content;
  });

  InlineGlyph.displayName = `${Namespace}.InlineGlyph`;

  /**
   * Component: <AxoSymbol.Icon>
   * --------------------------------------
   */

  export type IconName = AxoSymbolIconName;
  export type IconSize = 12 | 14 | 16 | 18 | 20 | 24 | 36 | 48;

  type IconSizeConfig = { size: number; fontSize: number };

  const IconSizes: Record<IconSize, IconSizeConfig> = {
    12: { size: 12, fontSize: 10 },
    14: { size: 14, fontSize: 12 },
    16: { size: 16, fontSize: 14 },
    18: { size: 18, fontSize: 16 },
    20: { size: 20, fontSize: 18 },
    24: { size: 24, fontSize: 22 },
    36: { size: 36, fontSize: 34 },
    48: { size: 48, fontSize: 44 },
  };

  export function _getAllIconSizes(): ReadonlyArray<IconSize> {
    return Object.keys(IconSizes).map(size => Number(size) as IconSize);
  }

  export type IconProps = Readonly<{
    size: IconSize;
    symbol: IconName;
    label: string | null;
    weight?: Weight;
  }>;

  const iconStyles = tw(
    'inline-flex size-[1em] shrink-0 items-center justify-center align-middle leading-none'
  );

  export const Icon: FC<IconProps> = memo(props => {
    const config = IconSizes[props.size];
    const direction = useDirection();
    const weight = props.weight ?? 400;
    const glyph = getAxoSymbolIcon(props.symbol, direction);
    const content = useRenderSymbol(glyph, props.label, weight);

    const style = useMemo(() => {
      return {
        width: config.size,
        height: config.size,
        fontSize: config.fontSize,
      };
    }, [config]);

    return (
      <span className={iconStyles} style={style}>
        {content}
      </span>
    );
  });

  Icon.displayName = `${Namespace}.Icon`;
}
