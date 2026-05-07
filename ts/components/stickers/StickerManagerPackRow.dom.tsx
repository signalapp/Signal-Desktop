// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  memo,
  useState,
  useCallback,
  type MouseEvent,
  type KeyboardEvent,
} from 'react';
import type { LocalizerType } from '../../types/Util.std.ts';
import type { StickerPackType } from '../../state/ducks/stickers.preload.ts';
import { Button, ButtonVariant } from '../Button.dom.tsx';
import { UserText } from '../UserText.dom.tsx';
import { AxoConfirmDialog } from '../../axo/AxoConfirmDialog.dom.tsx';

export type OwnProps = {
  readonly i18n: LocalizerType;
  readonly pack: StickerPackType;
  readonly onClickPreview?: (sticker: StickerPackType) => unknown;
  readonly installStickerPack?: (
    packId: string,
    packKey: string,
    options: { actionSource: 'ui' }
  ) => unknown;
  readonly uninstallStickerPack?: (
    packId: string,
    packKey: string,
    options: { actionSource: 'ui' }
  ) => unknown;
};

export type Props = OwnProps;

export const StickerManagerPackRow = memo(function StickerManagerPackRowInner({
  installStickerPack,
  uninstallStickerPack,
  onClickPreview,
  pack,
  i18n,
}: Props) {
  const { id, key, isBlessed } = pack;
  const [uninstalling, setUninstalling] = useState(false);

  const clearUninstalling = useCallback(() => {
    setUninstalling(false);
  }, [setUninstalling]);

  const handleInstall = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      if (installStickerPack) {
        installStickerPack(id, key, { actionSource: 'ui' });
      }
    },
    [id, installStickerPack, key]
  );

  const handleUninstall = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      if (isBlessed && uninstallStickerPack) {
        uninstallStickerPack(id, key, { actionSource: 'ui' });
      } else {
        setUninstalling(true);
      }
    },
    [id, isBlessed, key, setUninstalling, uninstallStickerPack]
  );

  const handleConfirmUninstall = useCallback(() => {
    clearUninstalling();
    if (uninstallStickerPack) {
      uninstallStickerPack(id, key, { actionSource: 'ui' });
    }
  }, [id, key, clearUninstalling, uninstallStickerPack]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (onClickPreview && (event.key === 'Enter' || event.key === 'Space')) {
        event.stopPropagation();
        event.preventDefault();

        onClickPreview(pack);
      }
    },
    [onClickPreview, pack]
  );

  const handleClickPreview = useCallback(
    (event: MouseEvent) => {
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
      <AxoConfirmDialog.Root
        open={uninstalling}
        onOpenChange={setUninstalling}
        // @ts-expect-error ConfirmationDialog migration: Needs title
        title={null}
        description={i18n('icu:stickers--StickerManager--UninstallWarning')}
      >
        <AxoConfirmDialog.Cancel />
        <AxoConfirmDialog.Action
          variant="destructive"
          onClick={handleConfirmUninstall}
        >
          {i18n('icu:stickers--StickerManager--Uninstall')}
        </AxoConfirmDialog.Action>
      </AxoConfirmDialog.Root>
      <div
        tabIndex={0}
        // This can't be a button because we have buttons as descendants
        role="button"
        onKeyDown={handleKeyDown}
        onClick={handleClickPreview}
        className="module-sticker-manager__pack-row"
        data-testid={id}
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
            <UserText text={pack.title} />
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
            <Button
              aria-label={i18n('icu:stickers--StickerManager--Uninstall')}
              variant={ButtonVariant.Secondary}
              onClick={handleUninstall}
            >
              {i18n('icu:stickers--StickerManager--Uninstall')}
            </Button>
          ) : (
            <Button
              aria-label={i18n('icu:stickers--StickerManager--Install')}
              variant={ButtonVariant.Secondary}
              onClick={handleInstall}
            >
              {i18n('icu:stickers--StickerManager--Install')}
            </Button>
          )}
        </div>
      </div>
    </>
  );
});
