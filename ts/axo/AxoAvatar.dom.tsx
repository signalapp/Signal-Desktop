// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  CSSProperties,
  FC,
  ImgHTMLAttributes,
  MouseEvent,
  ReactNode,
} from 'react';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { AxoSymbol } from './AxoSymbol.dom.tsx';
import { tw } from './tw.dom.tsx';
import {
  createStrictContext,
  useStrictContext,
} from './_internal/StrictContext.dom.tsx';
import { assert } from './_internal/assert.std.tsx';
import { AxoTokens } from './AxoTokens.std.ts';
import { variants } from './_internal/variants.dom.tsx';

/**
 * A circular avatar for displaying a user or group's profile image, initials,
 * gradient, or icon — with optional badge and unread-story ring overlays.
 *
 * @example Anatomy
 * ```tsx
 * <AxoAvatar.Root>
 *   <AxoAvatar.Content>
 *     {/* One of: *\/}
 *     <AxoAvatar.Image />
 *     <AxoAvatar.Initials />
 *     <AxoAvatar.Gradient />
 *     <AxoAvatar.Icon />
 *     <AxoAvatar.Preset />
 *     {/* Optional overlay: *\/}
 *     <AxoAvatar.ClickToView />
 *   </AxoAvatar.Content>
 *   <AxoAvatar.Badge />
 * </AxoAvatar.Root>
 * ```
 */
export namespace AxoAvatar {
  /**
   * Width and height of the avatar in pixels.
   */
  export type Size =
    | 20
    | 24
    | 28
    | 30
    | 32
    | 36
    | 40
    | 48
    | 52
    | 64
    | 72
    | 80
    | 96
    | 216;

  /** @internal */
  const SizeContext = createStrictContext<Size>('AxoAvatar.Root');

  const RootSizes = variants<Size>('AxoAvatar.Size', {
    20: tw('size-[20px]'),
    24: tw('size-[24px]'),
    28: tw('size-[28px]'),
    30: tw('size-[30px]'),
    32: tw('size-[32px]'),
    36: tw('size-[36px]'),
    40: tw('size-[40px]'),
    48: tw('size-[48px]'),
    52: tw('size-[52px]'),
    64: tw('size-[64px]'),
    72: tw('size-[72px]'),
    80: tw('size-[80px]'),
    96: tw('size-[96px]'),
    216: tw('size-[216px]'),
  });

  const RingSizes = variants<Size>('AxoAvatar.Size', {
    20: tw('border p-[1.5px]'),
    24: tw('border p-[1.5px]'),
    28: tw('border-[1.5px] p-[2px]'),
    30: tw('border-[1.5px] p-[2px]'),
    32: tw('border-[1.5px] p-[2px]'),
    36: tw('border-[1.5px] p-[2px]'),
    40: tw('border-[1.5px] p-[2px]'),
    48: tw('border-2 p-[3px]'),
    52: tw('border-2 p-[3px]'),
    64: tw('border-2 p-[3px]'),
    72: tw('border-[2.5px] p-[3.5px]'),
    80: tw('border-[2.5px] p-[3.5px]'),
    96: tw('border-[3px] p-[4px]'),
    216: tw('border-4 p-[6px]'),
  });

  /** @testexport */
  export function _getAllSizes(): ReadonlyArray<Size> {
    return RootSizes.keys().map(size => Number(size) as Size);
  }

  const DefaultColor = tw('bg-fill-secondary text-label-primary');

  /**
   * <AxoAvatar.Root>
   * --------------------------------------------------------------------------
   */

  export type RootProps = Readonly<{
    /**
     * Width and height of the avatar in pixels.
     */
    size: Size;
    /**
     * Story ring shown around the avatar.
     * - `unread`: Colored ring indicating an unread story.
     * - `read`: Dimmed ring indicating a viewed story.
     * - `null`: No ring.
     */
    ring?: 'unread' | 'read' | null;
    /**
     * Should be a `Content` element, optionally followed by a `Badge`.
     */
    children: ReactNode;
  }>;

  /**
   * Contains all the parts of an avatar.
   *
   * @example Contact avatar with initials and badge
   * ```tsx
   * <AxoAvatar.Root size={40} ring={hasUnreadStory ? 'unread' : null}>
   *   <AxoAvatar.Content label={contact.name}>
   *     <AxoAvatar.Initials initials={contact.initials} color={contact.color} />
   *   </AxoAvatar.Content>
   *   {contact.badge && (
   *     <AxoAvatar.Badge label={contact.badge.name} svgs={contact.badge.svgs} />
   *   )}
   * </AxoAvatar.Root>
   * ```
   */
  export const Root: FC<RootProps> = memo(props => {
    return (
      <SizeContext.Provider value={props.size}>
        <div
          className={tw(
            'relative shrink-0 rounded-full contain-layout select-none',
            RootSizes.get(props.size),
            props.ring != null && RingSizes.get(props.size),
            props.ring === 'unread' && 'border-border-selected',
            props.ring === 'read' && 'border-label-secondary'
          )}
        >
          {props.children}
        </div>
      </SizeContext.Provider>
    );
  });

  Root.displayName = 'AxoAvatar.Root';

  /**
   * <AxoAvatar.Content>
   * --------------------------------------------------------------------------
   */

  export type ContentProps = Readonly<{
    /**
     * Accessible label for the avatar.
     *
     * Pass `null` when the avatar is purely decorative and a nearby element
     * already identifies the contact.
     */
    label: string | null;
    /**
     * When provided, renders the content as a `<button>` with this click handler.
     * Without it, renders as a `<div role="img">`.
     */
    onClick?: ((event: MouseEvent<HTMLButtonElement>) => void) | null;
    /**
     * The visual content of the avatar, should be one of:
     *
     * - `Image`
     * - `Initials`
     * - `Gradient`
     * - `Icon`
     * - `Preset`
     *
     * Optionally followed by `ClickToView`.
     */
    children: ReactNode;
  }>;

  const baseContentStyles = tw(
    'relative size-full rounded-full contain-strict'
  );

  /**
   * The content of the avatar.
   *
   * Renders as a button when `onClick` is provided, otherwise as an image.
   */
  export const Content: FC<ContentProps> = memo(props => {
    if (props.onClick != null) {
      return (
        <ContentButton label={props.label} onClick={props.onClick}>
          {props.children}
        </ContentButton>
      );
    }

    return (
      <div
        role="img"
        aria-label={props.label ?? undefined}
        className={baseContentStyles}
      >
        {props.children}
      </div>
    );
  });

  Content.displayName = 'AxoAvatar.Content';

  /**
   * <AxoAvatar.ContentButton>
   * --------------------------------------------------------------------------
   */

  /** @internal */
  type ContentButtonProps = Readonly<{
    label: string | null;
    onClick: (event: MouseEvent<HTMLButtonElement>) => void;
    children: ReactNode;
  }>;

  /** @internal */
  const ContentButton: FC<ContentButtonProps> = memo(props => {
    const { onClick } = props;

    const handleClick = useCallback(
      (event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        onClick(event);
      },
      [onClick]
    );

    return (
      <button
        type="button"
        aria-label={props.label ?? undefined}
        className={tw(
          baseContentStyles,
          'outline-none keyboard-mode:focus:outline-focus-ring'
        )}
        onClick={handleClick}
      >
        {props.children}
      </button>
    );
  });

  ContentButton.displayName = 'AxoAvatar.ContentButton';

  /**
   * <AxoAvatar.Icon>
   * --------------------------------------------------------------------------
   */

  export type IconProps = Readonly<{
    /**
     * The icon to display. Sized proportionally to the avatar.
     */
    symbol: AxoSymbol.IconName;
  }>;

  /**
   * Displays a centered icon on a secondary fill background.
   */
  export const Icon: FC<IconProps> = memo(props => {
    const size = useStrictContext(SizeContext);
    return (
      <span
        className={tw(
          'flex size-full items-center justify-center',
          DefaultColor
        )}
        style={{ fontSize: size * 0.55 }}
      >
        <AxoSymbol.InlineGlyph symbol={props.symbol} label={null} />
      </span>
    );
  });

  Icon.displayName = 'AxoAvatar.Icon';

  /**
   * <AxoAvatar.Image>
   * --------------------------------------------------------------------------
   */

  export type ImageProps = Readonly<{
    /**
     * URL of the avatar image.
     */
    src: string;
    /**
     * Intrinsic width of the source image in pixels.
     */
    srcWidth: number;
    /**
     * Intrinsic height of the source image in pixels.
     */
    srcHeight: number;
    /**
     * When `true`, applies a blur and slight zoom to the image.
     */
    blur: boolean;
    /**
     * Icon to show if the image fails to load.
     */
    fallbackIcon: AxoSymbol.IconName;
    /**
     * Color theme for the fallback icon background.
     */
    fallbackColor: AxoTokens.Avatar.ColorName;
  }>;

  /**
   * Lazily loads a profile image. Falls back to `Icon` on load error.
   */
  export const Image: FC<ImageProps> = memo(props => {
    const { src } = props;

    const ref = useRef<HTMLImageElement>(null);
    const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
    const [brokenSrc, setBrokenSrc] = useState<string | null>(null);

    const isLoaded = src === loadedSrc;
    const isBroken = src === brokenSrc;

    const handleError = useCallback(() => {
      setBrokenSrc(src);
    }, [src]);

    const handleLoad = useCallback(() => {
      setLoadedSrc(src);
    }, [src]);

    if (!isLoaded && isBroken) {
      const color = AxoTokens.Avatar.getColorValues(props.fallbackColor);
      return (
        <div
          className={tw('size-full', props.blur && 'blur-thin')}
          style={{ background: color.bg, color: color.fg }}
        >
          <Icon symbol={props.fallbackIcon} />
        </div>
      );
    }

    return (
      // oxlint-disable-next-line jsx-a11y/alt-text
      <img
        ref={ref}
        src={props.src}
        width={props.srcWidth}
        height={props.srcHeight}
        decoding="async"
        fetchPriority="low"
        loading="lazy"
        draggable={false}
        onError={handleError}
        onLoad={handleLoad}
        className={tw(
          'size-full object-cover object-center',
          props.blur && 'scale-110 blur-thin',
          'transition-[filter] duration-100 ease-out-cubic',
          !isLoaded && 'opacity-0'
        )}
      />
    );
  });

  Image.displayName = 'AxoAvatar.Image';

  /**
   * <AxoAvatar.Preset>
   * --------------------------------------------------------------------------
   */

  export type PresetProps = Readonly<{
    /**
     * One of the pre-designed avatar presets (e.g. `"cat"`, `"abstract_01"`).
     */
    preset: AxoTokens.Avatar.PresetName;
  }>;

  /**
   * Displays one of the built-in preset avatar illustrations.
   */
  export const Preset: FC<PresetProps> = memo(props => {
    const { preset } = props;

    const src = useMemo(() => {
      return `images/avatars/avatar_${preset}.svg`;
    }, [preset]);

    const style = useMemo((): CSSProperties => {
      const colorName = AxoTokens.Avatar.getPresetColorName(preset);
      const color = AxoTokens.Avatar.getColorValues(colorName);
      return { background: color.bg };
    }, [preset]);

    return (
      // oxlint-disable-next-line jsx-a11y/alt-text
      <img
        src={src}
        width={1024}
        height={1024}
        className={tw('size-full object-cover object-center')}
        style={style}
      />
    );
  });

  Preset.displayName = 'AxoAvatar.Preset';

  /**
   * <AxoAvatar.ClickToView>
   * --------------------------------------------------------------------------
   */

  /** @testexport */
  export const MIN_CLICK_TO_VIEW_SIZE = 80;

  export type ClickToViewProps = Readonly<{
    /**
     * Accessible label and visible text for the overlay (e.g. `"View"`).
     */
    label: string;
  }>;

  /**
   * A semi-transparent overlay with a tap icon and label, used on profile
   * photos that open a full-screen viewer when clicked.
   * Only valid at size ≥ `MIN_CLICK_TO_VIEW_SIZE` (80px).
   */
  export const ClickToView: FC<ClickToViewProps> = memo(props => {
    const size = useStrictContext(SizeContext);

    assert(
      size >= MIN_CLICK_TO_VIEW_SIZE,
      `Cannot render <AxoAvatar.ClickToView> at a size smaller than ${MIN_CLICK_TO_VIEW_SIZE}`
    );

    return (
      <div
        className={tw(
          'absolute inset-0 rounded-full',
          'flex flex-col items-center-safe justify-center-safe gap-2',
          // oxlint-disable-next-line better-tailwindcss/no-restricted-classes
          'bg-[#000]/20 text-[#fff] hover:bg-[#000]/40',
          'outline-none keyboard-mode:focus:outline-focus-ring'
        )}
      >
        <AxoSymbol.Icon size={24} symbol="press" label={null} />
        <span className={tw('type-body-medium')}>{props.label}</span>
      </div>
    );
  });

  ClickToView.displayName = 'AxoAvatar.ClickToView';

  /**
   * <AxoAvatar.Initials>
   * --------------------------------------------------------------------------
   */

  export type InitialsProps = Readonly<{
    /**
     * 1–2 character string to display (e.g. `"JK"`).
     */
    initials: string;
    /**
     * Color theme for the background and text.
     */
    color: AxoTokens.Avatar.ColorName;
  }>;

  /**
   * Renders initials as an SVG on a colored background.
   */
  export const Initials: FC<InitialsProps> = memo(props => {
    const style = useMemo((): CSSProperties => {
      const color = AxoTokens.Avatar.getColorValues(props.color);
      return { fill: color.fg, background: color.bg };
    }, [props.color]);

    return (
      <svg
        width={256}
        height={256}
        viewBox="0 0 256 256"
        className={tw('size-full fill-current')}
        style={style}
      >
        <text
          x="50%"
          y="50%"
          dominantBaseline="central"
          textAnchor="middle"
          fontSize={120}
        >
          {props.initials}
        </text>
      </svg>
    );
  });

  Initials.displayName = 'AxoAvatar.Initials';

  /**
   * <AxoAvatar.Gradient>
   * --------------------------------------------------------------------------
   */

  export type GradientProps = Readonly<{
    /**
     * A numeric hash (typically derived from a conversation or user ID) that
     * deterministically selects one of the available gradient themes.
     */
    identifierHash: number;
  }>;

  /**
   * Fills the avatar with a gradient background chosen by `identifierHash`.
   */
  export const Gradient: FC<GradientProps> = memo(props => {
    const { identifierHash } = props;
    const style = useMemo((): CSSProperties => {
      const gradient = AxoTokens.Avatar.getGradientValuesByHash(identifierHash);
      return {
        backgroundImage:
          AxoTokens.Avatar.gradientToCssBackgroundImage(gradient),
      };
    }, [identifierHash]);
    return (
      <div className={tw('absolute inset-0 rounded-full')} style={style} />
    );
  });

  Gradient.displayName = 'AxoAvatar.Gradient';

  /**
   * <AxoAvatar.Badge>
   * --------------------------------------------------------------------------
   */

  /**
   * Paths to an SVG badge image for light and dark color schemes.
   */
  export type BadgeSvg = Readonly<{
    light: string;
    dark: string;
  }>;

  /**
   * Badge SVGs at each of the three rendered sizes (16, 24, and 36px).
   * The correct size is chosen automatically based on the avatar size.
   */
  export type BadgeSvgs = Readonly<{
    16: BadgeSvg;
    24: BadgeSvg;
    36: BadgeSvg;
  }>;

  export type BadgeProps = Readonly<{
    /**
     * Accessible label for the badge (e.g. `"Signal Planet"`).
     */
    label: string;
    /**
     * SVG paths for all badge sizes and color schemes.
     */
    svgs: BadgeSvgs;
    /**
     * When provided, renders the badge as a clickable `<button>`.
     */
    onClick?: ((event: MouseEvent<HTMLButtonElement>) => void) | null;
  }>;

  type BadgeSvgSize = keyof BadgeSvgs | null;
  const BadgeSvgSizes = variants<Size, BadgeSvgSize>('AxoAvatar.Size', {
    20: null,
    24: null,
    28: 16,
    30: 16,
    32: 16,
    36: 16,
    40: 24,
    48: 24,
    52: 24,
    64: 24,
    72: 36,
    80: 36,
    96: 36,
    216: 36,
  });

  const baseBadgeStyles = tw(
    'absolute rounded-full',
    // Proportionately sized & positioned based on the size of the avatar
    '-inset-e-[calc(2.75px-3%)] -bottom-[calc(6.25px-1%)] size-[calc(5px+37.5%)]'
  );

  /**
   * A donor badge overlaid on the bottom-end corner of the avatar.
   * Automatically picks the right size for the current avatar size.
   *
   * Note: Not rendered at sizes 20 or 24 (too small).
   */
  export const Badge: FC<BadgeProps> = memo(props => {
    const { svgs } = props;
    const avatarSize = useStrictContext(SizeContext);

    const badge = useMemo(() => {
      const badgeSize = BadgeSvgSizes.get(avatarSize);
      if (badgeSize == null) {
        return null;
      }
      const svg = svgs[badgeSize];
      if (svg == null) {
        return null;
      }
      return { size: badgeSize, light: svg.light, dark: svg.dark };
    }, [svgs, avatarSize]);

    if (badge == null) {
      return null;
    }

    const baseImageProps: Omit<
      ImgHTMLAttributes<HTMLImageElement>,
      'src' | 'className'
    > = {
      width: badge.size,
      height: badge.size,
      decoding: 'async',
      fetchPriority: 'low',
      loading: 'lazy',
      draggable: false,
    };

    const children = (
      <>
        {/* oxlint-disable-next-line jsx-a11y/alt-text */}
        <img
          {...baseImageProps}
          src={badge.light}
          className={tw('size-full dark:hidden')}
        />
        {/* oxlint-disable-next-line jsx-a11y/alt-text */}
        <img
          {...baseImageProps}
          src={badge.dark}
          className={tw('size-full not-dark:hidden')}
        />
      </>
    );

    if (props.onClick != null) {
      return (
        <BadgeButton label={props.label} onClick={props.onClick}>
          {children}
        </BadgeButton>
      );
    }

    return (
      <div className={tw(baseBadgeStyles, 'pointer-events-none')}>
        {children}
      </div>
    );
  });

  Badge.displayName = 'AxoAvatar.Badge';

  /**
   * <AxoAvatar.BadgeButton>
   * --------------------------------------------------------------------------
   */

  /** @internal */
  type BadgeButtonProps = Readonly<{
    label: string;
    onClick: (event: MouseEvent<HTMLButtonElement>) => void;
    children: ReactNode;
  }>;

  /** @internal */
  const BadgeButton: FC<BadgeButtonProps> = memo(props => {
    const { onClick } = props;

    const handleClick = useCallback(
      (event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        onClick(event);
      },
      [onClick]
    );

    return (
      <button
        type="button"
        aria-label={props.label}
        onClick={handleClick}
        className={tw(
          baseBadgeStyles,
          'outline-focus-ring-inset outline-none keyboard-mode:focus:outline-focus-ring'
        )}
      >
        {props.children}
      </button>
    );
  });

  BadgeButton.displayName = 'AxoAvatar.BadgeButton';
}
