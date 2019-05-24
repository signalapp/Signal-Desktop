import * as React from 'react';
import { StickerPackInstallButton } from './StickerPackInstallButton';
import { ConfirmationModal } from '../ConfirmationModal';
import { LocalizerType } from '../../types/Util';
import { StickerPackType } from '../../state/ducks/stickers';

export type OwnProps = {
  readonly i18n: LocalizerType;
  readonly pack: StickerPackType;
  readonly onClickPreview?: (sticker: StickerPackType) => unknown;
  readonly installStickerPack?: (packId: string, packKey: string) => unknown;
  readonly uninstallStickerPack?: (packId: string, packKey: string) => unknown;
};

export type Props = OwnProps;

export const StickerManagerPackRow = React.memo(
  // tslint:disable-next-line max-func-body-length
  ({
    installStickerPack,
    uninstallStickerPack,
    onClickPreview,
    pack,
    i18n,
  }: Props) => {
    const { id, key, isBlessed } = pack;
    const [uninstalling, setUninstalling] = React.useState(false);

    const clearUninstalling = React.useCallback(
      () => {
        setUninstalling(false);
      },
      [setUninstalling]
    );

    const handleInstall = React.useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        if (installStickerPack) {
          installStickerPack(id, key);
        }
      },
      [installStickerPack, pack]
    );

    const handleUninstall = React.useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isBlessed && uninstallStickerPack) {
          uninstallStickerPack(id, key);
        } else {
          setUninstalling(true);
        }
      },
      [setUninstalling, id, key, isBlessed]
    );

    const handleConfirmUninstall = React.useCallback(
      () => {
        clearUninstalling();
        if (uninstallStickerPack) {
          uninstallStickerPack(id, key);
        }
      },
      [id, key, clearUninstalling]
    );

    const handleClickPreview = React.useCallback(
      () => {
        if (onClickPreview) {
          onClickPreview(pack);
        }
      },
      [onClickPreview, pack]
    );

    return (
      <>
        {uninstalling ? (
          <ConfirmationModal
            i18n={i18n}
            onClose={clearUninstalling}
            negativeText={i18n('stickers--StickerManager--Uninstall')}
            onNegative={handleConfirmUninstall}
          >
            {i18n('stickers--StickerManager--UninstallWarning')}
          </ConfirmationModal>
        ) : null}
        <div
          role="button"
          onClick={handleClickPreview}
          className="module-sticker-manager__pack-row"
        >
          {pack.cover ? (
            <img
              src={pack.cover.url}
              alt={pack.title}
              className="module-sticker-manager__pack-row__cover"
            />
          ) : (
            <div className="module-sticker-manager__pack-row__cover-placeholder" />
          )}
          <div className="module-sticker-manager__pack-row__meta">
            <div className="module-sticker-manager__pack-row__meta__title">
              {pack.title}
              {pack.isBlessed ? (
                <span className="module-sticker-manager__pack-row__meta__blessed-icon" />
              ) : null}
            </div>
            <div className="module-sticker-manager__pack-row__meta__author">
              {pack.author}
            </div>
          </div>
          <div className="module-sticker-manager__pack-row__controls">
            {pack.status === 'installed' ? (
              <StickerPackInstallButton
                installed={true}
                i18n={i18n}
                onClick={handleUninstall}
              />
            ) : (
              <StickerPackInstallButton
                installed={false}
                i18n={i18n}
                onClick={handleInstall}
              />
            )}
          </div>
        </div>
      </>
    );
  }
);
