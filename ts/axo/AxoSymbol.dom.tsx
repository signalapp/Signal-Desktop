// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { CSSProperties, FC, JSX } from 'react';
import { memo, useMemo } from 'react';
import { Direction } from 'radix-ui';
import { VisuallyHidden } from 'react-aria';
import {
  _getAxoSymbolIcon,
  _getAxoSymbolInlineGlyph,
} from './_internal/AxoSymbolDefs.generated.std.ts';
import type { _AxoSymbolName } from './_internal/AxoSymbolDefs.generated.std.ts';

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
  export type Name = _AxoSymbolName;

  export type Weight = 300 | 400 | 600;

  /**
   * useRenderSymbol()
   * --------------------------------------
   */

  /** @internal */
  function useRenderSymbol(glyph: string, label: string | null): JSX.Element {
    return useMemo(() => {
      return (
        <>
          <span aria-hidden className="axo-symbol-glyph">
            {glyph}
          </span>
          {label != null && (
            <VisuallyHidden className="axo-symbol-label">
              {label}
            </VisuallyHidden>
          )}
        </>
      );
    }, [glyph, label]);
  }

  /**
   * <AxoSymbol.InlineGlyph>
   * --------------------------------------------------------------------------
   */

  export type InlineGlyphProps = Readonly<{
    /** The icon to render. */
    symbol: Name;
    /**
     * Accessible label for screen readers. Pass `null` if the glyph is purely
     * decorative and the surrounding context (Ex: a button's aria-label) already
     * conveys the meaning.
     */
    label: string | null;
    /** Prefer the -wide variants of glyphs (if available) */
    preferWide?: boolean;
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
    const glyph = props.preferWide
      ? _getAxoSymbolIcon(props.symbol, direction)
      : _getAxoSymbolInlineGlyph(props.symbol, direction);
    const content = useRenderSymbol(glyph, props.label);
    return content;
  });

  InlineGlyph.displayName = 'AxoSymbol.InlineGlyph';

  /**
   * <AxoSymbol.Icon>
   * --------------------------------------------------------------------------
   */

  /** Available icon sizes in pixels. */
  export type IconSize = 12 | 14 | 16 | 18 | 20 | 24 | 36 | 48;

  export type IconProps = Readonly<{
    /** Size of the icon in pixels. */
    size: IconSize;
    /** The icon to render. Automatically mirrored in RTL layouts. */
    symbol: Name;
    /**
     * Accessible label for screen readers. Pass `null` if the icon is purely
     * decorative and the surrounding context (Ex: a button's aria-label) already
     * conveys the meaning.
     */
    label: string | null;
  }>;

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
    const { size } = props;
    const direction = useDirection();
    const glyph = _getAxoSymbolIcon(props.symbol, direction);
    const content = useRenderSymbol(glyph, props.label);

    const style = useMemo((): CSSProperties => {
      return { fontSize: size };
    }, [size]);

    return (
      <span className="axo-symbol-icon" style={style}>
        {content}
      </span>
    );
  });

  Icon.displayName = 'AxoSymbol.Icon';
}
