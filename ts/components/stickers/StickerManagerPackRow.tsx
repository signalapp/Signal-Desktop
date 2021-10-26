// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { StickerPackInstallButton } from './StickerPackInstallButton';
import { ConfirmationDialog } from '../ConfirmationDialog';
import type { LocalizerType } from '../../types/Util';
import type { StickerPackType } from '../../state/ducks/stickers';

export type OwnProps = {
  readonly i18n: LocalizerType;
  readonly pack: StickerPackType;
  readonly onClickPreview?: (sticker: StickerPackType) => unknown;
  readonly installStickerPack?: (packId: string, packKey: string) => unknown;
  readonly uninstallStickerPack?: (packId: string, packKey: string) => unknown;
};

export type Props = OwnProps;

export const StickerManagerPackRow = React.memo(
  ({
    installStickerPack,
    uninstallStickerPack,
    onClickPreview,
    pack,
    i18n,
  }: Props) => {
    const { id, key, isBlessed } = pack;
    const [uninstalling, setUninstalling] = React.useState(false);

    const clearUninstalling = React.useCallback(() => {
      setUninstalling(false);
    }, [setUninstalling]);

    const handleInstall = React.useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        if (installStickerPack) {
          installStickerPack(id, key);
        }
      },
      [id, installStickerPack, key]
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
      [id, isBlessed, key, setUninstalling, uninstallStickerPack]
    );

    const handleConfirmUninstall = React.useCallback(() => {
      clearUninstalling();
      if (uninstallStickerPack) {
        uninstallStickerPack(id, key);
      }
    }, [id, key, clearUninstalling, uninstallStickerPack]);

    const handleKeyDown = React.useCallback(
      (event: React.KeyboardEvent) => {
        if (
          onClickPreview &&
          (event.key === 'Enter' || event.key === 'Space')
        ) {
          event.stopPropagation();
          event.preventDefault();

          onClickPreview(pack);
        }
      },
      [onClickPreview, pack]
    );

    const handleClickPreview = React.useCallback(
      (event: React.MouseEvent) => {
        if (onClickPreview) {
          event.stopPropagation();
          event.preventDefault();

          onClickPreview(pack);
        }
      },
      [onClickPreview, pack]
    );

    return (
      <>
        {uninstalling ? (
          <ConfirmationDialog
            i18n={i18n}
            onClose={clearUninstalling}
            actions={[
              {
                style: 'negative',
                text: i18n('stickers--StickerManager--Uninstall'),
                action: handleConfirmUninstall,
              },
            ]}
          >
            {i18n('stickers--StickerManager--UninstallWarning')}
          </ConfirmationDialog>
        ) : null}
        <div
          tabIndex={0}
          // This can't be a button because we have buttons as descendants
          role="button"
          onKeyDown={handleKeyDown}
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
                installed
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
