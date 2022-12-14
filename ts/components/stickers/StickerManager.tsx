// Copyright 2019-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { StickerManagerPackRow } from './StickerManagerPackRow';
import { StickerPreviewModal } from './StickerPreviewModal';
import type { LocalizerType } from '../../types/Util';
import type { StickerPackType } from '../../state/ducks/stickers';
import { Tabs } from '../Tabs';

export type OwnProps = {
  readonly blessedPacks: ReadonlyArray<StickerPackType>;
  readonly closeStickerPackPreview: (packId: string) => unknown;
  readonly downloadStickerPack: (packId: string, packKey: string) => unknown;
  readonly i18n: LocalizerType;
  readonly installStickerPack: (packId: string, packKey: string) => unknown;
  readonly installedPacks: ReadonlyArray<StickerPackType>;
  readonly knownPacks?: ReadonlyArray<StickerPackType>;
  readonly receivedPacks: ReadonlyArray<StickerPackType>;
  readonly uninstallStickerPack: (packId: string, packKey: string) => unknown;
};

export type Props = OwnProps;

enum TabViews {
  Available = 'Available',
  Installed = 'Installed',
}

export const StickerManager = React.memo(function StickerManagerInner({
  blessedPacks,
  closeStickerPackPreview,
  downloadStickerPack,
  i18n,
  installStickerPack,
  installedPacks,
  knownPacks,
  receivedPacks,
  uninstallStickerPack,
}: Props) {
  const focusRef = React.createRef<HTMLDivElement>();
  const [packToPreview, setPackToPreview] =
    React.useState<StickerPackType | null>(null);

  React.useEffect(() => {
    if (!knownPacks) {
      return;
    }
    knownPacks.forEach(pack => {
      downloadStickerPack(pack.id, pack.key);
    });

    // When this component is created, it's initially not part of the DOM, and then it's
    //   added off-screen and animated in. This ensures that the focus takes.
    setTimeout(() => {
      if (focusRef.current) {
        focusRef.current.focus();
      }
    });
    // We only want to attempt downloads on initial load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearPackToPreview = React.useCallback(() => {
    setPackToPreview(null);
  }, [setPackToPreview]);

  const previewPack = React.useCallback((pack: StickerPackType) => {
    setPackToPreview(pack);
  }, []);

  return (
    <>
      {packToPreview ? (
        <StickerPreviewModal
          closeStickerPackPreview={closeStickerPackPreview}
          downloadStickerPack={downloadStickerPack}
          i18n={i18n}
          installStickerPack={installStickerPack}
          onClose={clearPackToPreview}
          pack={packToPreview}
          uninstallStickerPack={uninstallStickerPack}
        />
      ) : null}
      <div className="module-sticker-manager" tabIndex={-1} ref={focusRef}>
        <Tabs
          initialSelectedTab={TabViews.Available}
          tabs={[
            {
              id: TabViews.Available,
              label: i18n('stickers--StickerManager--Available'),
            },
            {
              id: TabViews.Installed,
              label: i18n('stickers--StickerManager--InstalledPacks'),
            },
          ]}
        >
          {({ selectedTab }) => (
            <>
              {selectedTab === TabViews.Available && (
                <>
                  <h2 className="module-sticker-manager__text module-sticker-manager__text--heading">
                    {i18n('stickers--StickerManager--BlessedPacks')}
                  </h2>
                  {blessedPacks.length > 0 ? (
                    blessedPacks.map(pack => (
                      <StickerManagerPackRow
                        key={pack.id}
                        pack={pack}
                        i18n={i18n}
                        onClickPreview={previewPack}
                        installStickerPack={installStickerPack}
                        uninstallStickerPack={uninstallStickerPack}
                      />
                    ))
                  ) : (
                    <div className="module-sticker-manager__empty">
                      {i18n('stickers--StickerManager--BlessedPacks--Empty')}
                    </div>
                  )}

                  <h2 className="module-sticker-manager__text module-sticker-manager__text--heading">
                    {i18n('stickers--StickerManager--ReceivedPacks')}
                  </h2>
                  {receivedPacks.length > 0 ? (
                    receivedPacks.map(pack => (
                      <StickerManagerPackRow
                        key={pack.id}
                        pack={pack}
                        i18n={i18n}
                        onClickPreview={previewPack}
                        installStickerPack={installStickerPack}
                        uninstallStickerPack={uninstallStickerPack}
                      />
                    ))
                  ) : (
                    <div className="module-sticker-manager__empty">
                      {i18n('stickers--StickerManager--ReceivedPacks--Empty')}
                    </div>
                  )}
                </>
              )}
              {selectedTab === TabViews.Installed &&
                (installedPacks.length > 0 ? (
                  installedPacks.map(pack => (
                    <StickerManagerPackRow
                      key={pack.id}
                      pack={pack}
                      i18n={i18n}
                      onClickPreview={previewPack}
                      installStickerPack={installStickerPack}
                      uninstallStickerPack={uninstallStickerPack}
                    />
                  ))
                ) : (
                  <div className="module-sticker-manager__empty">
                    {i18n('stickers--StickerManager--InstalledPacks--Empty')}
                  </div>
                ))}
            </>
          )}
        </Tabs>
      </div>
    </>
  );
});
