// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { FC } from 'react';
import React, { memo, useMemo } from 'react';
import { Direction } from 'radix-ui';
import { VisuallyHidden } from 'react-aria';
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

  // eslint-disable-next-line no-inner-declarations
  function useRenderSymbol(glyph: string, label: string | null): JSX.Element {
    return useMemo(() => {
      return (
        <>
          <span aria-hidden className={symbolStyles}>
            {glyph}
          </span>
          {label != null && (
            <VisuallyHidden className={labelStyles}>{label}</VisuallyHidden>
          )}
        </>
      );
    }, [glyph, label]);
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
    const content = useRenderSymbol(glyph, props.label);
    return content;
  });

  InlineGlyph.displayName = `${Namespace}.InlineGlyph`;

  /**
   * Component: <AxoSymbol.Icon>
   * --------------------------------------
   */

  export type IconName = AxoSymbolIconName;
  export type IconSize = 12 | 14 | 16 | 20 | 24 | 48;

  type IconSizeConfig = { size: number; fontSize: number };

  const IconSizes: Record<IconSize, IconSizeConfig> = {
    12: { size: 12, fontSize: 11 },
    14: { size: 14, fontSize: 12 },
    16: { size: 16, fontSize: 14 },
    20: { size: 20, fontSize: 18 },
    24: { size: 24, fontSize: 22 },
    48: { size: 48, fontSize: 44 },
  };

  export function _getAllIconSizes(): ReadonlyArray<IconSize> {
    return Object.keys(IconSizes).map(size => Number(size) as IconSize);
  }

  export type IconProps = Readonly<{
    size: IconSize;
    symbol: IconName;
    label: string | null;
  }>;

  const iconStyles = tw(
    'inline-flex size-[1em] shrink-0 items-center justify-center'
  );

  export const Icon: FC<IconProps> = memo(props => {
    const config = IconSizes[props.size];
    const direction = useDirection();
    const glyph = getAxoSymbolIcon(props.symbol, direction);
    const content = useRenderSymbol(glyph, props.label);

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
