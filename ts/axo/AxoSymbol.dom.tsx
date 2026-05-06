// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { FC, JSX } from 'react';
import { memo, useMemo } from 'react';
import { Direction } from 'radix-ui';
import { VisuallyHidden } from 'react-aria';
import { tw } from './tw.dom.tsx';
import {
  getAxoSymbolIcon,
  getAxoSymbolInlineGlyph,
} from './_internal/AxoSymbolDefs.generated.std.ts';
import type {
  AxoSymbolIconName,
  AxoSymbolInlineGlyphName,
} from './_internal/AxoSymbolDefs.generated.std.ts';
import { variants } from './_internal/variants.dom.tsx';

const { useDirection } = Direction;

/**
 * Renders symbols from the Axo symbol font — either as a fixed-size block icon
 * or as an inline glyph that flows with surrounding text.
 *
 * @example Anatomy
 * ```tsx
 * // Fixed-size icon, e.g. in buttons or list items
 * <AxoSymbol.Icon size={20} symbol="check" label={null} />
 *
 * // Inline glyph, e.g. directional arrows inside button labels
 * <AxoSymbol.InlineGlyph symbol="arrow-end" label={null} />
 * ```
 */
export namespace AxoSymbol {
  /**
   * Stroke weight of the symbol.
   * - `300` – light
   * - `400` – regular (default)
   * - `700` – semibold
   */
  export type Weight = 300 | 400 | 700;

  /**
   * useRenderSymbol()
   * --------------------------------------
   */

  const WeightStyles = variants<Weight>('AxoSymbol.Weight', {
    300: tw('font-light'),
    400: tw(),
    700: tw('font-semibold'),
  });

  /** @internal */
  function useRenderSymbol(
    glyph: string,
    label: string | null,
    weight: Weight
  ): JSX.Element {
    return useMemo(() => {
      return (
        <>
          <span
            aria-hidden
            className={tw('font-symbols select-none', WeightStyles.get(weight))}
          >
            {glyph}
          </span>
          {label != null && (
            <VisuallyHidden className={tw('select-none')}>
              {label}
            </VisuallyHidden>
          )}
        </>
      );
    }, [glyph, label, weight]);
  }

  /**
   * <AxoSymbol.InlineGlyph>
   * --------------------------------------------------------------------------
   */

  /**
   * A symbol font name that can be used as an inline glyph. May have small
   * visual differences from the "icon" appearance to look better inline with
   * text.
   *
   * Note: Auto-generated from the symbol font.
   *
   */
  export type InlineGlyphName = AxoSymbolInlineGlyphName;

  export type InlineGlyphProps = Readonly<{
    /** The icon to render. */
    symbol: InlineGlyphName;
    /**
     * Accessible label for screen readers. Pass `null` if the glyph is purely
     * decorative and the surrounding context (Ex: a button's aria-label) already
     * conveys the meaning.
     */
    label: string | null;
  }>;

  /**
   * An inline symbol that flows with surrounding text. Use when you want to
   * match the font size and don't care about the width of the icon.
   *
   * @example Within a labeled element
   * ```tsx
   * <button>
   *   Expand items
   *   <AxoSymbol.InlineGlyph symbol="arrow-down" label={null} />
   * </button>
   * ```
   *
   * @example Outside a labeled element
   * ```tsx
   * <p>
   *   {"Then click on the "}
   *   <AxoSymbol.InlineGlyph symbol="arrow-[end]" label="Next page" />
   *   {" button"}
   * </p>
   * ```
   */
  export const InlineGlyph: FC<InlineGlyphProps> = memo(props => {
    const direction = useDirection();
    const glyph = getAxoSymbolInlineGlyph(props.symbol, direction);
    const content = useRenderSymbol(glyph, props.label, 400);
    return content;
  });

  InlineGlyph.displayName = 'AxoSymbol.InlineGlyph';

  /**
   * <AxoSymbol.Icon>
   * --------------------------------------------------------------------------
   */

  /**
   * A symbol font name that can be used as an icon. May have small
   * visual differences from the "inline glyph" appearance to look better as a
   * standalone icon.
   *
   * Note: Auto-generated from the symbol font.
   */
  export type IconName = AxoSymbolIconName;

  /** Available icon sizes in pixels. */
  export type IconSize = 12 | 14 | 16 | 18 | 20 | 24 | 36 | 48;

  const IconSizes = variants<IconSize>('AxoSymbol.IconSize', {
    12: tw('size-[12px] text-[10px]'),
    14: tw('size-[14px] text-[12px]'),
    16: tw('size-[16px] text-[14px]'),
    18: tw('size-[18px] text-[16px]'),
    20: tw('size-[20px] text-[18px]'),
    24: tw('size-[24px] text-[22px]'),
    36: tw('size-[36px] text-[34px]'),
    48: tw('size-[48px] text-[44px]'),
  });

  /** @testexport */
  export function _getAllIconSizes(): ReadonlyArray<IconSize> {
    return IconSizes.keys().map(size => Number(size) as IconSize);
  }

  export type IconProps = Readonly<{
    /** Size of the icon in pixels. */
    size: IconSize;
    /** The icon to render. Automatically mirrored in RTL layouts. */
    symbol: IconName;
    /**
     * Accessible label for screen readers. Pass `null` if the icon is purely
     * decorative and the surrounding context (Ex: a button's aria-label) already
     * conveys the meaning.
     */
    label: string | null;
    /** Stroke weight of the icon. Defaults to `400`. */
    weight?: Weight;
  }>;

  const iconStyles = tw(
    'inline-flex size-[1em] shrink-0 items-center justify-center align-middle leading-none'
  );

  /**
   * A fixed-size icon. Prefer using this when the width and height both matter.
   *
   * @example Within a labeled element
   * ```tsx
   * <button aria-label="Expand items">
   *   <AxoSymbol.Icon size={20} symbol="arrow-down" label={null} />
   * </button>
   * ```
   *
   * @example Outside a labeled element
   * ```tsx
   * <AxoSymbol.Icon size={20} symbol="shield-check" label="Verified" />
   * ```
   */
  export const Icon: FC<IconProps> = memo(props => {
    const direction = useDirection();
    const weight = props.weight ?? 400;
    const glyph = getAxoSymbolIcon(props.symbol, direction);
    const content = useRenderSymbol(glyph, props.label, weight);
    return (
      <span className={tw(iconStyles, IconSizes.get(props.size))}>
        {content}
      </span>
    );
  });

  Icon.displayName = 'AxoSymbol.Icon';
}
