import * as React from 'react';
import classNames from 'classnames';
import { StickerManagerPackRow } from './StickerManagerPackRow';
import { StickerPreviewModal } from './StickerPreviewModal';
import { LocalizerType } from '../../types/Util';
import { StickerPackType } from '../../state/ducks/stickers';

export type OwnProps = {
  readonly installedPacks: ReadonlyArray<StickerPackType>;
  readonly receivedPacks: ReadonlyArray<StickerPackType>;
  readonly blessedPacks: ReadonlyArray<StickerPackType>;
  readonly knownPacks?: ReadonlyArray<StickerPackType>;
  readonly downloadStickerPack: (packId: string, packKey: string) => unknown;
  readonly installStickerPack: (packId: string, packKey: string) => unknown;
  readonly uninstallStickerPack: (packId: string, packKey: string) => unknown;
  readonly i18n: LocalizerType;
};

export type Props = OwnProps;

export const StickerManager = React.memo(
  ({
    installedPacks,
    receivedPacks,
    knownPacks,
    blessedPacks,
    downloadStickerPack,
    installStickerPack,
    uninstallStickerPack,
    i18n,
  }: Props) => {
    const [
      packToPreview,
      setPackToPreview,
    ] = React.useState<StickerPackType | null>(null);

    React.useEffect(() => {
      if (!knownPacks) {
        return;
      }
      knownPacks.forEach(pack => {
        downloadStickerPack(pack.id, pack.key);
      });
    }, []);

    const clearPackToPreview = React.useCallback(
      () => {
        setPackToPreview(null);
      },
      [setPackToPreview]
    );

    const previewPack = React.useCallback(
      (pack: StickerPackType) => {
        setPackToPreview(pack);
      },
      [clearPackToPreview]
    );

    return (
      <>
        {packToPreview ? (
          <StickerPreviewModal
            i18n={i18n}
            pack={packToPreview}
            onClose={clearPackToPreview}
            downloadStickerPack={downloadStickerPack}
            installStickerPack={installStickerPack}
            uninstallStickerPack={uninstallStickerPack}
          />
        ) : null}
        <div className="module-sticker-manager">
          {[
            {
              i18nKey: 'stickers--StickerManager--InstalledPacks',
              i18nEmptyKey: 'stickers--StickerManager--InstalledPacks--Empty',
              packs: installedPacks,
              hideIfEmpty: false,
            },
            {
              i18nKey: 'stickers--StickerManager--BlessedPacks',
              i18nEmptyKey: 'stickers--StickerManager--BlessedPacks--Empty',
              packs: blessedPacks,
              hideIfEmpty: true,
            },
            {
              i18nKey: 'stickers--StickerManager--ReceivedPacks',
              i18nEmptyKey: 'stickers--StickerManager--ReceivedPacks--Empty',
              packs: receivedPacks,
              hideIfEmpty: false,
            },
          ].map(section => {
            if (section.hideIfEmpty && section.packs.length === 0) {
              return;
            }

            return (
              <React.Fragment key={section.i18nKey}>
                <h2
                  className={classNames(
                    'module-sticker-manager__text',
                    'module-sticker-manager__text--heading'
                  )}
                >
                  {i18n(section.i18nKey)}
                </h2>
                {section.packs.length > 0 ? (
                  section.packs.map(pack => (
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
                    {i18n(section.i18nEmptyKey)}
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </>
    );
  }
);
