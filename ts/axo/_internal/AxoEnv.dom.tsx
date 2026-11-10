// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { memo, useInsertionEffect } from 'react';
import type { FC, ReactNode } from 'react';
import { createStrictContext, useStrictContext } from './StrictContext.dom.tsx';

const EnvContext = createStrictContext<AxoEnv.Env>('AxoEnv.Provider');

export namespace AxoEnv {
  /** The environment the app is running in. */
  export type Env = 'test' | 'dev' | 'prod';

  export type ProviderProps = Readonly<{
    env: Env;
    children: ReactNode;
  }>;

  export const Provider: FC<ProviderProps> = memo(props => {
    const { env } = props;

    // Never removed, other roots in the document may still need it
    // Could be removed once we only have one react root in the app
    useInsertionEffect(() => {
      document.documentElement.setAttribute('data-axo-env', env);
    }, [env]);

    return <EnvContext value={env}>{props.children}</EnvContext>;
  });

  Provider.displayName = 'AxoEnv.Provider';
}

/** Returns the environment the app is running in. */
export function useAxoEnv(): AxoEnv.Env {
  return useStrictContext(EnvContext);
}
