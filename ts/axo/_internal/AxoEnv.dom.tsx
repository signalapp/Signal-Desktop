// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { memo, useInsertionEffect } from 'react';
import type { FC, ReactNode } from 'react';
import { createStrictContext, useStrictContext } from './StrictContext.dom.tsx';

const EnvContext = createStrictContext<AxoEnv.Env>('AxoEnv.Provider');

let currentEnv: AxoEnv.Env | null = null;

export namespace AxoEnv {
  /** The environment the app is running in. */
  export type Env = 'test' | 'dev' | 'prod';

  export type ProviderProps = Readonly<{
    env: Env;
    children: ReactNode;
  }>;

  export const Provider: FC<ProviderProps> = memo(props => {
    const { env } = props;
    // Set during render so the first render can already read it
    currentEnv = env;

    // Never removed, other roots in the document may still need it
    // Could be removed once we only have one react root in the app
    useInsertionEffect(() => {
      document.documentElement.setAttribute('data-axo-env', env);
    }, [env]);

    return <EnvContext value={env}>{props.children}</EnvContext>;
  });

  Provider.displayName = 'AxoEnv.Provider';
}

/**
 * Returns the environment for code outside of components, or `null` before
 * any `<AxoEnv.Provider>` has rendered.
 */
export function getCurrentAxoEnv(): AxoEnv.Env | null {
  return currentEnv;
}

/** Returns the environment the app is running in. */
export function useAxoEnv(): AxoEnv.Env {
  return useStrictContext(EnvContext);
}
