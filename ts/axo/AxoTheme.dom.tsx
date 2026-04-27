// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FC, ReactNode } from 'react';
import React, { memo, createContext, useContext } from 'react';
import type { TailwindStyles } from './tw.dom.tsx';
import { tw } from './tw.dom.tsx';

const Namespace = 'AxoTheme';

export namespace AxoTheme {
  export type ThemeOverride = 'force-light' | 'force-dark' | 'auto';

  const ThemeOverrides: Record<ThemeOverride, TailwindStyles> = {
    'force-light': tw('scheme-light'),
    'force-dark': tw('scheme-dark'),
    auto: tw('scheme-light dark:scheme-dark'),
  };

  const ThemeOverrideContext = createContext<ThemeOverride>('auto');

  /**
   * <AxoTheme.Overide>
   * ------------------
   */

  export type OverrideProps = Readonly<{
    theme: ThemeOverride;
    children: ReactNode;
  }>;

  export const Override: FC<OverrideProps> = memo(props => {
    return (
      <ThemeOverrideContext.Provider value={props.theme}>
        <div className={ThemeOverrides[props.theme]}>{props.children}</div>
      </ThemeOverrideContext.Provider>
    );
  });

  Override.displayName = `${Namespace}.Override`;

  /**
   * <AxoTheme.Inherit>
   * ------------------
   */

  export type InheritProps = Readonly<{
    children: ReactNode;
  }>;

  export const Inherit: FC<InheritProps> = memo(props => {
    const theme = useContext(ThemeOverrideContext);
    return <div className={ThemeOverrides[theme]}>{props.children}</div>;
  });

  Inherit.displayName = `${Namespace}.Inherit`;
}
