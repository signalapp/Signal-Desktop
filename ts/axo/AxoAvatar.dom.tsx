// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  CSSProperties,
  FC,
  ImgHTMLAttributes,
  MouseEventHandler,
  ReactNode,
} from 'react';
import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import { AxoSymbol } from './AxoSymbol.dom.js';
import type { TailwindStyles } from './tw.dom.js';
import { tw } from './tw.dom.js';
import {
  createStrictContext,
  useStrictContext,
} from './_internal/StrictContext.dom.js';
import { assert } from './_internal/assert.std.js';
import { AxoTokens } from './AxoTokens.std.js';

const Namespace = 'AxoAvatar';

/**
 * @example Anatomy
 * ```tsx
 * <AxoAvatar.Root>
 *   <AxoAvatar.Content>
 *     {
 *       <AxoAvatar.Icon/> ||
 *       <AxoAvatar.Initials/> ||
 *       <AxoAvatar.Gradient/> ||
 *       <AxoAvatar.Image/>
 *     }
 *     <AxoAvatar.ClickToView/>
 *   </AxoAvatar.Content>
 *   <AxoAvatar.Badge/>
 * </AxoAlertDialog.Root>
 * ```
 */
export namespace AxoAvatar {
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

  const SizeContext = createStrictContext<Size>(`${Namespace}.Root`);

  const RootSizes: Record<Size, TailwindStyles> = {
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
  };

  const RingSizes: Record<Size, TailwindStyles | null> = {
    20: tw('border-[1px] p-[1.5px]'),
    24: tw('border-[1px] p-[1.5px]'),
    28: tw('border-[1.5px] p-[2px]'),
    30: tw('border-[1.5px] p-[2px]'),
    32: tw('border-[1.5px] p-[2px]'),
    36: tw('border-[1.5px] p-[2px]'),
    40: tw('border-[1.5px] p-[2px]'),
    48: tw('border-[2px] p-[3px]'),
    52: tw('border-[2px] p-[3px]'),
    64: tw('border-[2px] p-[3px]'),
    72: tw('border-[2.5px] p-[3.5px]'),
    80: tw('border-[2.5px] p-[3.5px]'),
    96: tw('border-[3px] p-[4px]'),
    216: tw('border-[4px] p-[6px]'),
  };

  export function _getAllSizes(): ReadonlyArray<Size> {
    return Object.keys(RootSizes).map(size => Number(size) as Size);
  }

  const DefaultColor = tw('bg-fill-secondary text-label-primary');

  /**
   * Component: <AxoAvatar.Root>
   * ---------------------------
   */

  export type RootProps = Readonly<{
    size: Size;
    ring?: 'unread' | 'read' | null;
    children: ReactNode;
  }>;

  export const Root: FC<RootProps> = memo(props => {
    return (
      <SizeContext.Provider value={props.size}>
        <div
          className={tw(
            'relative shrink-0 rounded-full contain-layout select-none',
            RootSizes[props.size],
            props.ring != null && RingSizes[props.size],
            props.ring === 'unread' && 'border-border-selected',
            props.ring === 'read' && 'border-label-secondary'
          )}
        >
          {props.children}
        </div>
      </SizeContext.Provider>
    );
  });

  Root.displayName = `${Namespace}.Root`;

  /**
   * Component: <AxoAvatar.Content>
   * ------------------------------
   */

  export type ContentProps = Readonly<{
    label: string | null;
    onClick?: MouseEventHandler<HTMLButtonElement> | null;
    children: ReactNode;
  }>;

  export const Content: FC<ContentProps> = memo(props => {
    const ariaLabel = props.label ?? undefined;
    const baseClassName = tw('relative size-full rounded-full contain-strict');

    let result: ReactNode;
    if (props.onClick != null) {
      result = (
        <button
          type="button"
          aria-label={ariaLabel}
          className={tw(
            baseClassName,
            'outline-0 outline-border-focused focused:outline-[2.5px]'
          )}
          onClick={props.onClick}
        >
          {props.children}
        </button>
      );
    } else {
      result = (
        <div role="img" aria-label={ariaLabel} className={baseClassName}>
          {props.children}
        </div>
      );
    }
    return result;
  });

  Content.displayName = `${Namespace}.Content`;

  /**
   * Component: <AxoAvatar.Icon>
   * ---------------------------
   */

  export type IconProps = Readonly<{
    symbol: AxoSymbol.IconName;
  }>;

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

  Icon.displayName = `${Namespace}.Icon`;

  /**
   * Component: <AxoAvatar.Image>
   * ----------------------------
   */

  export type ImageProps = Readonly<{
    src: string;
    srcWidth: number;
    srcHeight: number;
    blur: boolean;
    fallbackIcon: AxoSymbol.IconName;
    fallbackColor: AxoTokens.Avatar.ColorName;
  }>;

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
      // eslint-disable-next-line jsx-a11y/alt-text
      <img
        ref={ref}
        src={props.src}
        width={props.srcWidth}
        height={props.srcHeight}
        decoding="async"
        // eslint-disable-next-line react/no-unknown-property
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

  Image.displayName = `${Namespace}.Image`;

  /**
   * Component: <AxoAvatar.PresetImage>
   */

  export type PresetProps = Readonly<{
    preset: AxoTokens.Avatar.PresetName;
  }>;

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
      // eslint-disable-next-line jsx-a11y/alt-text
      <img
        src={src}
        width={1024}
        height={1024}
        className={tw('size-full object-cover object-center')}
        style={style}
      />
    );
  });

  Preset.displayName = `${Namespace}.Preset`;

  /**
   * Component: <AxoAvatar.ClickToView>
   * ----------------------------------
   */

  export const MIN_CLICK_TO_VIEW_SIZE = 80;

  export type ClickToViewProps = Readonly<{
    label: string;
  }>;

  export const ClickToView: FC<ClickToViewProps> = memo(props => {
    const size = useStrictContext(SizeContext);

    assert(
      size >= MIN_CLICK_TO_VIEW_SIZE,
      `Cannot render ${Namespace}.ClickToView at a size smaller than ${MIN_CLICK_TO_VIEW_SIZE}`
    );

    return (
      <div
        className={tw(
          'absolute inset-0 rounded-full',
          'flex flex-col items-center-safe justify-center-safe gap-2',
          // eslint-disable-next-line better-tailwindcss/no-restricted-classes
          'bg-[#000]/20 text-[#fff] hover:bg-[#000]/40',
          'outline-0 outline-border-focused focused:outline-[2.5px]'
        )}
      >
        <AxoSymbol.Icon size={24} symbol="press" label={null} />
        <span className={tw('type-body-medium')}>{props.label}</span>
      </div>
    );
  });

  ClickToView.displayName = `${Namespace}.ClickToView`;

  /**
   * Component: <AxoAvatar.Initials>
   * -------------------------------
   */

  export type InitialsProps = Readonly<{
    initials: string;
    color: AxoTokens.Avatar.ColorName;
  }>;

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

  Initials.displayName = `${Namespace}.Initials`;

  /**
   * Component: <AxoAvatar.Gradient>
   * -------------------------------
   */

  export type GradientProps = Readonly<{
    identifierHash: number;
  }>;

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

  Gradient.displayName = `${Namespace}.Gradient`;

  /**
   * Component: <AxoAvatar.Badge>
   * ----------------------------
   */

  export type BadgeSvg = Readonly<{
    light: string;
    dark: string;
  }>;

  export type BadgeSvgs = Readonly<{
    16: BadgeSvg;
    24: BadgeSvg;
    36: BadgeSvg;
  }>;

  export type BadgeProps = Readonly<{
    label: string;
    svgs: BadgeSvgs;
    onClick?: MouseEventHandler<HTMLButtonElement> | null;
  }>;

  const BadgeSvgSizes: Record<Size, keyof BadgeSvgs | null> = {
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
  };

  export const Badge: FC<BadgeProps> = memo(props => {
    const { svgs } = props;
    const avatarSize = useStrictContext(SizeContext);

    const badge = useMemo(() => {
      const badgeSize = BadgeSvgSizes[avatarSize];
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
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <img
          {...baseImageProps}
          src={badge.light}
          className={tw('size-full dark:hidden')}
        />
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <img
          {...baseImageProps}
          src={badge.dark}
          className={tw('size-full not-dark:hidden')}
        />
      </>
    );

    const baseClassName = tw(
      'absolute rounded-full',
      // Proportionately sized & positioned based on the size of the avatar
      '-end-[calc(2.75px-3%)] -bottom-[calc(6.25px-1%)] size-[calc(5px+37.5%)]'
    );

    let result: ReactNode;
    if (props.onClick != null) {
      result = (
        <button
          type="button"
          aria-label={props.label}
          onClick={props.onClick}
          className={tw(
            baseClassName,
            'outline-0 -outline-offset-[2.5px] outline-border-focused focused:outline-[2.5px]'
          )}
        >
          {children}
        </button>
      );
    } else {
      result = (
        <div className={tw(baseClassName, 'pointer-events-none')}>
          {children}
        </div>
      );
    }

    return result;
  });

  Badge.displayName = `${Namespace}.Badge`;
}
