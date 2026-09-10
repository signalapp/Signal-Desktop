// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode, FC } from 'react';
import { memo } from 'react';
import { tw } from './tw.dom.tsx';

export namespace AxoContainer {
  /**
   * <AxoContainer.Root>
   * --------------------------------------------------------------------------
   */

  export type RootProps = Readonly<{
    children: ReactNode;
  }>;

  export const Root: FC<RootProps> = memo(props => {
    return (
      <div
        className={tw(
          'mx-auto w-full min-w-min',
          // TODO(jamie): Once all items have been migrated, we want to set the max-width to 640px
          'max-w-[750px]',
          'px-4 pt-2 pb-4'
        )}
      >
        {props.children}
      </div>
    );
  });

  Root.displayName = 'AxoContainer.Root';
}
