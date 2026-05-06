// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FC, ReactNode } from 'react';
import { memo, createContext, useContext } from 'react';
import { tw } from './tw.dom.tsx';
import { variants } from './_internal/variants.dom.tsx';

/**
 * Controls the color scheme applied to a subtree.
 *
 * Use {@link Override} at section boundaries to set or force a color scheme,
 * and {@link Inherit} inside portals to re-apply the parent's scheme across
 * the portal boundary.
 *
 * @example Anatomy
 * ```tsx
 * <AxoTheme.Override theme="force-dark">
 *   <AxoTheme.Inherit>
 *     {/* portal content inherits force-dark *\/}
 *   </AxoTheme.Inherit>
 * </AxoTheme.Override>
 * ```
 */
export namespace AxoTheme {
  /**
   * <AxoTheme.Overide>
   * --------------------------------------------------------------------------
   */

  /**
   * The color scheme to apply to a subtree.
   * - `auto`: Reverts to the app's setting, which inherits from the OS (default).
   * - `force-light`: Always light, regardless of system setting.
   * - `force-dark`: Always dark, regardless of system setting.
   */
  export type ThemeOverride = 'force-light' | 'force-dark' | 'auto';

  const ThemeOverrides = variants<ThemeOverride>('AxoTheme.ThemeOverride', {
    'force-light': tw('scheme-light'),
    'force-dark': tw('scheme-dark'),
    auto: tw('scheme-light dark:scheme-dark'),
  });

  /** @internal */
  const ThemeOverrideContext = createContext<ThemeOverride>('auto');

  /**
   * <AxoTheme.Overide>
   * --------------------------------------------------------------------------
   */

  export type OverrideProps = Readonly<{
    /** The color scheme to apply. */
    theme: ThemeOverride;
    /** The subtree to apply the color scheme to. */
    children: ReactNode;
  }>;

  /**
   * Sets the color scheme for a subtree. Use at section boundaries where the
   * theme should differ from the rest of the page (e.g. always-dark overlays).
   *
   * @example Force dark theme in a calling UI
   * ```tsx
   * <AxoTheme.Override theme="force-dark">
   *   <CallingControls />
   * </AxoTheme.Override>
   * ```
   */
  export const Override: FC<OverrideProps> = memo(props => {
    return (
      <ThemeOverrideContext.Provider value={props.theme}>
        <div className={ThemeOverrides.get(props.theme)}>{props.children}</div>
      </ThemeOverrideContext.Provider>
    );
  });

  Override.displayName = 'AxoTheme.Override';

  /**
   * <AxoTheme.Inherit>
   * --------------------------------------------------------------------------
   */

  export type InheritProps = Readonly<{
    /** The portal content that should inherit the parent's color scheme. */
    children: ReactNode;
  }>;

  /**
   * Re-applies the nearest {@link Override}'s color scheme to a subtree.
   * Required inside portals, since portal content renders outside the DOM
   * tree and won't automatically inherit CSS from the parent.
   *
   * @example Wrap portal content so it inherits the active theme
   * ```tsx
   * <Dialog.Portal>
   *   <AxoTheme.Inherit>
   *     <Dialog.Content>...</Dialog.Content>
   *   </AxoTheme.Inherit>
   * </Dialog.Portal>
   * ```
   */
  export const Inherit: FC<InheritProps> = memo(props => {
    const theme = useContext(ThemeOverrideContext);
    return <div className={ThemeOverrides.get(theme)}>{props.children}</div>;
  });

  Inherit.displayName = 'AxoTheme.Inherit';
}
