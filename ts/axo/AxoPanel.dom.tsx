// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode, FC } from 'react';
import { memo } from 'react';
import { tw } from './tw.dom.tsx';
import { AxoScrollArea } from './AxoScrollArea.dom.tsx';
import { AxoIconButton } from './AxoIconButton.dom.tsx';
import { useAxoIntl } from './_internal/AxoIntl.dom.tsx';
import { AxoContainer } from './AxoContainer.dom.tsx';

export namespace AxoPanel {
  /**
   * <AxoPanel.Root>
   * --------------------------------------------------------------------------
   */

  export type RootProps = Readonly<{
    children?: ReactNode;
  }>;

  export const Root: FC<RootProps> = memo(props => {
    return (
      <div
        className={tw(
          'relative',
          'size-full',
          'pt-7',
          'min-h-0 min-w-0',
          'flex flex-col',
          'bg-surface-primary'
        )}
      >
        {props.children}
      </div>
    );
  });

  Root.displayName = 'AxoPanel.Root';

  /**
   * <AxoPanel.Header>
   * --------------------------------------------------------------------------
   */

  export type HeaderProps = Readonly<{
    children: ReactNode;
  }>;

  export const Header: FC<HeaderProps> = memo(props => {
    return (
      <header
        className={tw(
          'h-13 shrink-0',
          'grid items-center gap-2',
          'grid-cols-[[back-slot]_1fr_[label-slot]_auto_[reserved-slot]_1fr]'
        )}
      >
        {props.children}
      </header>
    );
  });

  Header.displayName = 'AxoPanel.Header';

  /**
   * <AxoPanel.Back>
   * --------------------------------------------------------------------------
   */

  export type BackProps = Readonly<{
    onClick: () => void;
  }>;

  export const Back: FC<BackProps> = memo(props => {
    const intl = useAxoIntl();
    return (
      <div className={tw('col-[back-slot] row-1')}>
        <AxoIconButton.Root
          size="md"
          variant="implied-secondary"
          symbol="chevron-[start]"
          label={intl.get('AxoDialog.Back')}
          tooltip={false}
          onClick={props.onClick}
        />
      </div>
    );
  });

  Back.displayName = 'AxoPanel.Back';

  /**
   * <AxoPanel.Label>
   * --------------------------------------------------------------------------
   */

  export type LabelProps = Readonly<{
    children?: ReactNode;
  }>;

  export const Label: FC<LabelProps> = memo(props => {
    return (
      <h1
        className={tw(
          'col-[label-slot] row-1',
          'py-1.5',
          'truncate text-center',
          'type-title-small font-semibold text-primary'
        )}
      >
        {props.children}
      </h1>
    );
  });

  Label.displayName = 'AxoPanel.Label';

  /**
   * <AxoPanel.Content>
   * --------------------------------------------------------------------------
   */

  export type ContentProps = Readonly<{
    children: ReactNode;
  }>;

  export const Content: FC<ContentProps> = memo(props => {
    return (
      <main className={tw('min-h-0 grow')}>
        <AxoScrollArea.Root scrollbarWidth="wide">
          <AxoScrollArea.Hint edge="top" />
          <AxoScrollArea.Viewport>
            <AxoScrollArea.Content>
              <AxoContainer.Root>{props.children}</AxoContainer.Root>
            </AxoScrollArea.Content>
          </AxoScrollArea.Viewport>
        </AxoScrollArea.Root>
      </main>
    );
  });

  Content.displayName = 'AxoPanel.Content';
}
