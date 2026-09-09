// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  memo,
  createRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type JSX,
} from 'react';
import { isEqual, partition } from 'lodash';

import {
  StickerManagerPackRow,
  type StickerManagerPackRowControlType,
} from './StickerManagerPackRow.dom.tsx';
import { StickerPreviewModal } from './StickerPreviewModal.dom.tsx';
import type { LocalizerType } from '../../types/Util.std.ts';
import type { StickerPackType } from '../../state/ducks/stickers.preload.ts';
import type { ShowToastAction } from '../../state/ducks/toast.preload.ts';
import type { StickerManagerTabType } from '../../types/Stickers.preload.ts';
import { tw } from '../../axo/tw.dom.tsx';
import { AxoButton } from '../../axo/AxoButton.dom.tsx';
import { ListBox, useDragAndDrop } from 'react-aria-components';

export type OwnProps = {
  readonly blessedPacks: ReadonlyArray<StickerPackType>;
  readonly closeStickerPackPreview: () => unknown;
  readonly downloadStickerPack: (
    packId: string,
    packKey: string,
    options: { actionSource: 'ui' }
  ) => unknown;
  readonly i18n: LocalizerType;
  readonly installStickerPack: (
    packId: string,
    packKey: string,
    options: { actionSource: 'ui' }
  ) => unknown;
  readonly installedPacks: ReadonlyArray<StickerPackType>;
  readonly knownPacks?: ReadonlyArray<StickerPackType>;
  readonly receivedPacks: ReadonlyArray<StickerPackType>;
  readonly tab: StickerManagerTabType;
  readonly setTab: (value: StickerManagerTabType) => void;
  readonly showToast: ShowToastAction;
  readonly uninstallStickerPack: (
    packId: string,
    packKey: string,
    options: { actionSource: 'ui' }
  ) => unknown;
  readonly updateStickerPacksPositions: (
    orderedPackids: ReadonlyArray<string>
  ) => void;
};

export type Props = OwnProps;

export const StickerManager = memo(function StickerManagerInner({
  blessedPacks,
  closeStickerPackPreview,
  downloadStickerPack,
  i18n,
  installStickerPack,
  installedPacks,
  knownPacks,
  receivedPacks,
  tab,
  setTab,
  showToast,
  uninstallStickerPack,
  updateStickerPacksPositions,
}: Props) {
  const focusRef = createRef<HTMLDivElement>();
  const [packIdToPreview, setPackIdToPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!knownPacks) {
      return;
    }
    knownPacks.forEach(pack => {
      downloadStickerPack(pack.id, pack.key, { actionSource: 'ui' });
    });

    // When this component is created, it's initially not part of the DOM, and then it's
    //   added off-screen and animated in. This ensures that the focus takes.
    setTimeout(() => {
      if (focusRef.current) {
        focusRef.current.focus();
      }
    });
    // We only want to attempt downloads on initial load
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearPackToPreview = useCallback(() => {
    setPackIdToPreview(null);
  }, [setPackIdToPreview]);

  const previewPack = useCallback((packId: string) => {
    setPackIdToPreview(packId);
  }, []);

  const renderStickerPackRow = useCallback(
    (
      pack: StickerPackType,
      controlType: StickerManagerPackRowControlType
    ): JSX.Element => (
      <StickerManagerPackRow
        controlType={controlType}
        key={pack.id}
        i18n={i18n}
        pack={pack}
        onClickPreview={previewPack}
        installStickerPack={installStickerPack}
        uninstallStickerPack={uninstallStickerPack}
      />
    ),
    [i18n, installStickerPack, previewPack, uninstallStickerPack]
  );

  const setTabAll = useCallback(() => setTab('all'), [setTab]);

  const allPacks = useMemo(() => {
    const packsMap = new Map<string, StickerPackType>();
    const packsList = [
      ...blessedPacks,
      ...installedPacks,
      ...(knownPacks ?? []),
      ...receivedPacks,
    ];
    packsList.forEach(pack => {
      if (packsMap.get(pack.id)) {
        return;
      }

      packsMap.set(pack.id, pack);
    });
    return packsMap;
  }, [blessedPacks, installedPacks, knownPacks, receivedPacks]);

  const [installedPacksReordered, setInstalledPacksReordered] =
    useState(installedPacks);

  useEffect(() => {
    setInstalledPacksReordered(installedPacks);
  }, [installedPacks]);

  const { dragAndDropHooks } = useDragAndDrop({
    getItems: () => {
      return installedPacks.map(pack => {
        return { 'signal-sticker-pack-id': pack.id };
      });
    },
    getAllowedDropOperations() {
      return ['move'];
    },
    acceptedDragTypes: ['signal-sticker-pack-id'],
    getDropOperation: () => 'move',
    onDragEnd: () => {
      if (!hasPacksOrderChanged(installedPacks, installedPacksReordered)) {
        return;
      }

      updateStickerPacksPositions(installedPacksReordered.map(pack => pack.id));
    },
    onReorder: event => {
      const target = event.target.key as string;
      const moving = event.keys as Set<string>;
      const position = event.target.dropPosition;

      if (position !== 'before' && position !== 'after') {
        return;
      }

      setInstalledPacksReordered(prevPacks => {
        return movePacks(prevPacks, target, moving, position);
      });
    },
    renderDropIndicator: () => {
      return <div className={tw('-my-px h-0.5 rounded-full bg-inverted')} />;
    },
  });

  const packToPreview = useMemo(() => {
    return packIdToPreview ? allPacks.get(packIdToPreview) : undefined;
  }, [allPacks, packIdToPreview]);

  return (
    <div
      className={tw('m-auto max-w-152 px-4 py-0 focus-visible:axo-focus-ring')}
      data-testid="StickerManager"
      tabIndex={-1}
      ref={focusRef}
    >
      {packIdToPreview ? (
        <StickerPreviewModal
          closeStickerPackPreview={closeStickerPackPreview}
          downloadStickerPack={downloadStickerPack}
          i18n={i18n}
          installStickerPack={installStickerPack}
          onClose={clearPackToPreview}
          pack={packToPreview}
          uninstallStickerPack={uninstallStickerPack}
          showToast={showToast}
        />
      ) : null}
      {tab === 'all' && (
        <>
          <h2
            className={tw(
              'mx-2 my-1 type-body-medium font-semibold text-primary'
            )}
          >
            {i18n('icu:stickers--StickerManager--BlessedPacks')}
          </h2>
          {blessedPacks.length > 0 ? (
            <ListBox
              aria-label={i18n(
                'icu:stickers--StickerManagerBlessedPacksList--Label'
              )}
              data-testid="StickerManagerBlessedPacks"
              items={blessedPacks}
            >
              {pack => renderStickerPackRow(pack, 'install-button')}
            </ListBox>
          ) : (
            <p className={tw('mx-2 mb-1 type-body-small text-secondary')}>
              {i18n('icu:stickers--StickerManager--BlessedPacks--Empty')}
            </p>
          )}
          <div className={tw('mb-4')} />

          {receivedPacks.length > 0 && (
            <>
              <h2
                className={tw(
                  'mx-2 mt-2 mb-0.5 type-body-medium font-semibold text-primary'
                )}
              >
                {i18n('icu:stickers--StickerManager--ReceivedPacks2')}
              </h2>
              <p className={tw('mx-2 mb-1 type-body-small text-secondary')}>
                {i18n('icu:stickers--StickerManager--ReceivedPacksDescription')}
              </p>
              <ListBox
                aria-label={i18n(
                  'icu:stickers--StickerManagerReceivedPacksList--Label'
                )}
                data-testid="StickerManagerReceivedPacks"
                items={receivedPacks}
              >
                {pack => renderStickerPackRow(pack, 'install-button')}
              </ListBox>
            </>
          )}
        </>
      )}
      {tab === 'my-stickers' &&
        (installedPacks.length > 0 ? (
          <ListBox
            aria-label={i18n(
              'icu:stickers--StickerManagerInstalledPacksList--Label'
            )}
            data-testid="StickerManagerInstalledPacks"
            items={installedPacksReordered}
            dragAndDropHooks={dragAndDropHooks}
            autoFocus
            selectionMode="single"
            selectionBehavior="replace"
            disallowEmptySelection
          >
            {pack => renderStickerPackRow(pack, 'drag-handle')}
          </ListBox>
        ) : (
          <MyStickersEmpty i18n={i18n} setTabAll={setTabAll} />
        ))}
    </div>
  );
});

function MyStickersEmpty(props: {
  i18n: LocalizerType;
  setTabAll: () => void;
}): JSX.Element {
  const { i18n, setTabAll } = props;

  return (
    <div
      className={tw('m-auto grid min-h-screen place-items-center text-center')}
    >
      <div className={tw('max-w-60')}>
        <div className={tw('mb-4 type-body-medium text-secondary')}>
          {i18n('icu:stickers--StickerManager--MyStickers--None')}
        </div>
        <div>
          <AxoButton.Root
            variant="strong-secondary"
            size="md"
            onClick={setTabAll}
          >
            {i18n('icu:stickers--StickerManager--AddStickers')}
          </AxoButton.Root>
        </div>
      </div>
    </div>
  );
}

function movePacks(
  packs: ReadonlyArray<StickerPackType>,
  target: string,
  moving: Set<string>,
  position: 'before' | 'after'
): ReadonlyArray<StickerPackType> {
  const [toSplice, toInsert] = partition(packs, pack => {
    return !moving.has(pack.id);
  });

  const targetIndex = toSplice.findIndex(pack => {
    return pack.id === target;
  });

  if (targetIndex === -1) {
    return packs;
  }

  const spliceIndex = position === 'before' ? targetIndex : targetIndex + 1;

  return toSplice.toSpliced(spliceIndex, 0, ...toInsert);
}

function hasPacksOrderChanged(
  packs: ReadonlyArray<StickerPackType>,
  packsReordered: ReadonlyArray<StickerPackType>
): boolean {
  const a = packs.map(pack => pack.id);
  const b = packsReordered.map(pack => pack.id);
  return !isEqual(a, b);
}
