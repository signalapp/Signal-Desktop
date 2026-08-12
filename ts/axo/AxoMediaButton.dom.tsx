// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FC, MouseEvent } from 'react';
import { memo, useCallback, useMemo } from 'react';
import { AxoSymbol } from './AxoSymbol.dom.tsx';
import { tw } from './tw.dom.tsx';
import { variants } from './_internal/variants.dom.tsx';
import { AxoBaseSpinner } from './status/_AxoBaseSpinner.dom.tsx';
import { assert } from './_internal/assert.std.tsx';
import { forwardExtraPropsForRadix } from './_internal/props.dom.tsx';

export namespace AxoMediaButton {
  export type Status = 'paused' | 'playing' | 'undownloaded' | 'downloading';

  const Statuses = variants<Status, AxoSymbol.Name>(
    'AxoMediaButton.Status',
    {
      paused: 'play-fill',
      playing: 'pause-fill',
      undownloaded: 'arrow-down',
      downloading: 'x',
    }
  );

  export type RootProps = Readonly<{
    status: Status;
    downloadedBytes: number | 'indeterminate';
    totalBytes: number | 'indeterminate';
    /**
     * When `true`, prevents interaction.
     */
    disabled?: boolean | null;
    /**
     * Called when the button is clicked. Not called when `pending` or `disabled`.
     */
    onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  }>;

  export const Root: FC<RootProps> = memo(props => {
    const { status, downloadedBytes, totalBytes, disabled, onClick, ...rest } =
      props;

    const handleClick = useCallback(
      (event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        if (disabled) {
          event.preventDefault();
          return;
        }
        onClick(event);
      },
      [disabled, onClick]
    );

    return (
      <button
        type="button"
        className={tw(
          'relative rounded-full leading-none',
          'p-3',
          'bg-material-quaternary backdrop-blur-thin',
          'text-primary',
          'aria-disabled:text-placeholder',
          'not-forced-colors:outline-none keyboard-mode:focus:axo-focus-ring',
          'forced-colors:border forced-colors:border-[ButtonBorder] forced-colors:bg-[ButtonFace] forced-colors:text-[ButtonText]',
          'forced-colors:aria-disabled:text-[GrayText]'
        )}
        aria-disabled={disabled ?? undefined}
        onClick={handleClick}
        {...forwardExtraPropsForRadix(rest)}
      >
        <AxoSymbol.Icon size={24} symbol={Statuses.get(status)} label={null} />
        {status === 'downloading' && (
          <Spinner
            size={42}
            downloadedBytes={downloadedBytes}
            totalBytes={totalBytes}
          />
        )}
      </button>
    );
  });

  Root.displayName = 'AxoMediaButton.Root';

  /** @internal */
  type SpinnerProps = Readonly<{
    size: number;
    downloadedBytes: number | 'indeterminate';
    totalBytes: number | 'indeterminate';
  }>;

  /** @internal */
  const Spinner: FC<SpinnerProps> = memo(props => {
    const { downloadedBytes, totalBytes } = props;

    const value = useMemo((): AxoBaseSpinner.Value => {
      assert(
        totalBytes !== 0,
        'totalBytes should not be 0, use "indeterminate"'
      );

      if (
        downloadedBytes === 'indeterminate' ||
        totalBytes === 'indeterminate'
      ) {
        return 'indeterminate';
      }
      return { completed: downloadedBytes, total: totalBytes };
    }, [downloadedBytes, totalBytes]);

    return (
      <span className={tw('absolute inset-0 flex items-center justify-center')}>
        <AxoBaseSpinner.Root
          size={props.size}
          weight="regular"
          variant="default"
          value={value}
          track={false}
        />
      </span>
    );
  });

  Spinner.displayName = 'AxoMediaButton.Spinner';
}
