// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { memo, useId, useMemo, type FC, type ReactNode } from 'react';
import { tw } from '../tw.dom.tsx';
import {
  createStrictContext,
  useStrictContext,
} from '../_internal/StrictContext.dom.tsx';

export namespace AxoChatDateSection {
  /**
   * <AxoChatDateSection.Root>
   * --------------------------------------------------------------------------
   */

  type RootContextType = Readonly<{
    headerId: string;
  }>;

  const RootContext = createStrictContext<RootContextType>(
    'AxoChatDateSection.Root'
  );

  export type RootProps = Readonly<{
    children: ReactNode;
  }>;

  export const Root: FC<RootProps> = memo(props => {
    const headerId = useId();
    const context = useMemo((): RootContextType => {
      return { headerId };
    }, [headerId]);
    return (
      <RootContext value={context}>
        <section aria-labelledby={headerId}>{props.children}</section>
      </RootContext>
    );
  });

  Root.displayName = 'AxoChatDateSection.Root';

  /**
   * <AxoChatDateSection.Header>
   * --------------------------------------------------------------------------
   */
  export type HeaderProps = Readonly<{
    children: ReactNode;
  }>;

  export const Header: FC<HeaderProps> = memo(props => {
    const context = useStrictContext(RootContext);
    return (
      <div
        className={tw(
          '@container-[scroll-state]',
          'sticky -top-0.5 z-10',
          'flex justify-center',
          'px-4 py-2.5'
        )}
      >
        <h3
          id={context.headerId}
          className={tw(
            'px-3 py-1',
            'text-center',
            'type-body-small font-semibold text-secondary',
            'truncate',
            'rounded-full',
            'stuck-t:text-primary',
            'stuck-t:bg-material-primary',
            'stuck-t:backdrop-blur-thin',
            'stuck-t:shadow-elevation-1',
            'forced-colors:stuck-t:border forced-colors:stuck-t:border-[CanvasText]',
            'transition-shadow'
          )}
        >
          {props.children}
        </h3>
      </div>
    );
  });

  Header.displayName = 'AxoChatDateSection.Header';
}
