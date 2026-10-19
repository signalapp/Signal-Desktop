// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  useState,
  useCallback,
  type JSX,
  type MouseEvent,
  type ReactNode,
  useMemo,
  type CSSProperties,
  useEffect,
  useRef,
  useId,
} from 'react';
import type { LocalizerType } from '../types/Util.std.ts';
import type {
  PresentedSource,
  PresentableSource,
} from '../types/Calling.std.ts';
import { strictAssert } from '../util/assert.std.ts';
import { AxoDialog } from '../axo/AxoDialog.dom.tsx';
import { tw } from '../axo/tw.dom.tsx';
import { createLogger } from '../logging/log.std.ts';
import { AxoSymbol } from '../axo/AxoSymbol.dom.tsx';
import type { Uint16 } from '@signalapp/types';
import { AxoLoadingIndicator } from '../axo/status/AxoLoadingIndicator.dom.tsx';
import { drop } from '../util/drop.std.ts';
import * as Errors from '../types/errors.std.ts';

const log = createLogger('CallingSelectPresentingSourcesModal');

export type CallingSelectPresentingSourcesModalProps = Readonly<{
  i18n: LocalizerType;
  sources: ReadonlyArray<PresentableSource>;
  onSourceSelect: (id: string) => void;
  onCancel: () => void;
}>;

export function CallingSelectPresentingSourcesModal(
  props: CallingSelectPresentingSourcesModalProps
): JSX.Element | null {
  const { i18n, sources, onSourceSelect, onCancel } = props;
  const [selected, setSelected] = useState<PresentedSource | null>(null);

  const handleConfirm = useCallback(() => {
    strictAssert(selected, 'No source to present');
    onSourceSelect(selected.id);
  }, [selected, onSourceSelect]);

  const sourcesByType = useMemo(() => {
    const screens: Array<PresentableSource> = [];
    const windows: Array<PresentableSource> = [];

    for (const source of sources) {
      if (source.isScreen) {
        screens.push(source);
      } else {
        windows.push(source);
      }
    }

    return { screens, windows };
  }, [sources]);

  return (
    <AxoDialog.Root open onOpenChange={onCancel}>
      <AxoDialog.Content size="lg" escape="cancel-is-noop">
        <AxoDialog.Header>
          <AxoDialog.Title>
            {i18n('icu:calling__SelectPresentingSourcesModal--title')}
          </AxoDialog.Title>
          <AxoDialog.Close />
        </AxoDialog.Header>
        <AxoDialog.Body>
          <div className={tw('flex flex-col gap-2')}>
            {sourcesByType.screens.length !== 0 && (
              <SourceGrid
                label={i18n(
                  'icu:calling__SelectPresentingSourcesModal--entireScreen'
                )}
              >
                {sourcesByType.screens.map(source => {
                  return (
                    <Source
                      key={source.id}
                      source={source}
                      isSelected={selected?.id === source.id}
                      onSelect={setSelected}
                    />
                  );
                })}
              </SourceGrid>
            )}

            {sourcesByType.windows.length !== 0 && (
              <SourceGrid
                label={i18n(
                  'icu:calling__SelectPresentingSourcesModal--window'
                )}
              >
                {sourcesByType.windows.map(source => {
                  return (
                    <Source
                      key={source.id}
                      source={source}
                      isSelected={selected?.id === source.id}
                      onSelect={setSelected}
                    />
                  );
                })}
              </SourceGrid>
            )}
          </div>
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Actions>
            <AxoDialog.Action onClick={onCancel} variant="subtle-secondary">
              {i18n('icu:cancel')}
            </AxoDialog.Action>
            <AxoDialog.Action
              variant="strong-primary"
              disabled={selected == null}
              onClick={handleConfirm}
            >
              {i18n('icu:calling__SelectPresentingSourcesModal--confirm')}
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}

type SourceGridProps = Readonly<{
  label: string;
  children: ReactNode;
}>;

function SourceGrid(props: SourceGridProps): ReactNode {
  const labelId = useId();
  return (
    <section aria-labelledby={labelId}>
      <h4 id={labelId} className={tw('mb-1 type-title-small')}>
        {props.label}
      </h4>
      <div className={tw('grid grid-cols-4 gap-2')}>{props.children}</div>
    </section>
  );
}

type SourceProps = Readonly<{
  source: PresentableSource;
  isSelected: boolean;
  onSelect: (source: PresentedSource) => void;
}>;

function Source(props: SourceProps): ReactNode {
  const { source, isSelected, onSelect } = props;

  const handleClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      onSelect(source);
    },
    [onSelect, source]
  );

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={isSelected}
      className={tw(
        'curved-lg p-1',
        'shadow-elevation-0',
        'bg-surface-card text-primary',
        'aria-pressed:bg-accent aria-pressed:text-primary-oncolor',
        'focus-visible:axo-focus-ring'
      )}
    >
      <div
        className={tw(
          'flex items-center justify-center overflow-clip curved-md'
        )}
      >
        <SourceThumbnail
          src={source.thumbnail.src}
          width={source.thumbnail.width}
          height={source.thumbnail.height}
        />
      </div>
      <div className={tw('mt-1 flex items-center justify-center')}>
        {source.appIcon != null && (
          <img
            role="none"
            src={source.appIcon.src}
            alt=""
            width={source.appIcon.width}
            height={source.appIcon.height}
            className={tw('me-1 size-4 object-contain')}
          />
        )}
        <span className={tw('truncate type-body-small')}>{source.name}</span>
      </div>
    </button>
  );
}

type SourceThumbnailProps = Readonly<{
  src: string;
  width: Uint16;
  height: Uint16;
}>;

function SourceThumbnail(props: SourceThumbnailProps): ReactNode {
  const { src, width, height } = props;

  const ref = useRef<HTMLImageElement | null>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [erroredSrc, setErroredSrc] = useState<string | null>(null);

  useEffect(() => {
    if (ref.current == null) {
      return;
    }
    return decodeImage(ref.current, error => {
      if (error != null) {
        log.error('Failed to decode image', Errors.toLogFormat(error));
        setErroredSrc(src);
        return;
      }
      setLoadedSrc(src);
      setErroredSrc(null);
    });
  }, [src]);

  const isLoaded = loadedSrc === src;
  const isErrored = erroredSrc === src;

  const showLoading = !isLoaded && !isErrored;
  const showError = !isLoaded && isErrored;
  const showImage = isLoaded && !isErrored;

  return (
    <AspectRatio width={width} height={height}>
      {showLoading && <AxoLoadingIndicator.Root size="md" />}
      {showError && (
        <AxoSymbol.Icon size={24} symbol="error-triangle" label={null} />
      )}
      <img
        ref={ref}
        role="none"
        src={src}
        width={width}
        height={height}
        alt=""
        className={tw(
          'absolute size-full object-cover',
          !showImage && 'invisible'
        )}
      />
    </AspectRatio>
  );
}

type AspectRatioProps = Readonly<{
  width: Uint16;
  height: Uint16;
  children: ReactNode;
}>;

function AspectRatio(props: AspectRatioProps): ReactNode {
  const { width, height, children } = props;

  const style = useMemo((): CSSProperties => {
    return {
      width,
      aspectRatio: `${width} / ${height}`,
    };
  }, [width, height]);

  return (
    <div
      className={tw('relative flex max-w-full items-center justify-center')}
      style={style}
    >
      {children}
    </div>
  );
}

function decodeImage(
  image: HTMLImageElement,
  callback: (error: DOMException | null) => void
) {
  let canceled = false;
  async function run() {
    try {
      await image.decode();
      if (!canceled) {
        callback(null);
      }
    } catch (error) {
      if (!canceled) {
        callback(error);
      }
    }
  }
  drop(run());
  return () => {
    canceled = true;
  };
}
