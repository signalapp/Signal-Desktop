// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { memo, useState, useEffect, useCallback } from 'react';
import type { LocalizerType } from '../../types/Util.std.ts';
import type { StickerPackType } from '../../state/ducks/stickers.preload.ts';
import { UserText } from '../UserText.dom.tsx';
import { AxoConfirmDialog } from '../../axo/AxoConfirmDialog.dom.tsx';
import { AxoDialog } from '../../axo/AxoDialog.dom.tsx';
import { tw } from '../../axo/tw.dom.tsx';
import { AxoSymbol } from '../../axo/AxoSymbol.dom.tsx';
import { SpinnerV2 } from '../SpinnerV2.dom.tsx';

export type Props = Readonly<{
  onClose?: () => void;
  closeStickerPackPreview: () => void;
  downloadStickerPack: (
    packId: string,
    packKey: string,
    options: { finalStatus?: 'installed' | 'downloaded'; actionSource: 'ui' }
  ) => void;
  installStickerPack: (
    packId: string,
    packKey: string,
    options: { actionSource: 'ui' }
  ) => void;
  uninstallStickerPack: (
    packId: string,
    packKey: string,
    options: { actionSource: 'ui' }
  ) => void;
  pack?: StickerPackType;
  i18n: LocalizerType;
}>;

function renderBody({ pack, i18n }: Pick<Props, 'i18n' | 'pack'>) {
  if (pack == null) {
    return null;
  }

  if (pack.status === 'error') {
    return (
      <div
        className={tw('px-12 py-6 text-center text-color-label-destructive')}
      >
        {i18n('icu:stickers--StickerPreview--Error')}
      </div>
    );
  }

  if (pack.stickerCount === 0) {
    return (
      <div className={tw('flex justify-center py-6')}>
        <SpinnerV2
          variant="no-background-light"
          size={56}
          strokeWidth={2}
          value="indeterminate"
        />
      </div>
    );
  }

  const placeholders = pack.stickerCount - pack.stickers.length;

  return (
    <div className={tw('grid grid-cols-4 items-center justify-center gap-2')}>
      {pack.stickers.map(({ id, url }) => (
        <img
          key={id}
          className={tw(
            'aspect-square max-h-24 w-full max-w-24 object-contain'
          )}
          src={url}
          alt={pack.title}
        />
      ))}
      {Array.from({ length: placeholders }, (_, index) => {
        return (
          <div
            key={index}
            className={tw('aspect-square rounded-md bg-fill-secondary')}
          />
        );
      })}
    </div>
  );
}

export const StickerPreviewModal = memo(function StickerPreviewModalInner({
  closeStickerPackPreview,
  downloadStickerPack,
  i18n,
  installStickerPack,
  onClose,
  pack,
  uninstallStickerPack,
}: Props) {
  const [confirmingUninstall, setConfirmingUninstall] = useState(false);

  useEffect(() => {
    if (pack && pack.status === 'known') {
      downloadStickerPack(pack.id, pack.key, { actionSource: 'ui' });
    }
    if (
      pack &&
      pack.status === 'error' &&
      (pack.attemptedStatus === 'downloaded' ||
        pack.attemptedStatus === 'installed')
    ) {
      downloadStickerPack(pack.id, pack.key, {
        actionSource: 'ui',
        finalStatus: pack.attemptedStatus,
      });
    }
    // We only want to attempt downloads on initial load
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (pack) {
      return;
    }

    // Pack fully uninstalled, don't keep the modal open
    closeStickerPackPreview();
  }, [pack, closeStickerPackPreview]);

  const handleClose = useCallback(() => {
    if (pack) {
      closeStickerPackPreview();
    }
    onClose?.();
  }, [closeStickerPackPreview, onClose, pack]);

  const isInstalled = Boolean(pack && pack.status === 'installed');

  const handleInstall = useCallback(() => {
    if (!pack) {
      return;
    }

    if (pack.status === 'ephemeral') {
      downloadStickerPack(pack.id, pack.key, {
        finalStatus: 'installed',
        actionSource: 'ui',
      });
    } else {
      installStickerPack(pack.id, pack.key, { actionSource: 'ui' });
    }

    handleClose();
  }, [downloadStickerPack, installStickerPack, handleClose, pack]);

  const handleStartUninstall = useCallback(() => {
    setConfirmingUninstall(true);
  }, []);

  const handleUninstall = useCallback(() => {
    if (!pack) {
      return;
    }
    uninstallStickerPack(pack.id, pack.key, { actionSource: 'ui' });
    setConfirmingUninstall(false);
  }, [uninstallStickerPack, setConfirmingUninstall, pack]);

  return (
    <>
      <AxoDialog.Root open onOpenChange={handleClose}>
        <AxoDialog.Content size="md" escape="cancel-is-noop">
          <AxoDialog.Header>
            <AxoDialog.Title>
              {i18n('icu:stickers--StickerPreview--Title')}
            </AxoDialog.Title>
            <AxoDialog.Close />
          </AxoDialog.Header>
          <AxoDialog.Body>{renderBody({ pack, i18n })}</AxoDialog.Body>
          <AxoDialog.Footer>
            {pack != null && pack.status != null && pack.status !== 'error' && (
              <AxoDialog.FooterContent>
                <h3 className={tw('text-label-primary')}>
                  <UserText text={pack.title} />
                  {pack.isBlessed && (
                    <span className={tw('text-color-fill-primary')}>
                      {' '}
                      <AxoSymbol.InlineGlyph
                        symbol="check-circle-fill"
                        label={null}
                      />
                    </span>
                  )}
                </h3>
                <p className={tw('text-label-secondary')}>{pack.author}</p>
              </AxoDialog.FooterContent>
            )}
            <AxoDialog.Actions>
              {isInstalled ? (
                <AxoDialog.Action
                  variant="destructive"
                  onClick={handleStartUninstall}
                >
                  {i18n('icu:stickers--StickerManager--Uninstall')}
                </AxoDialog.Action>
              ) : (
                <AxoDialog.Action
                  variant="primary"
                  onClick={handleInstall}
                  pending={pack?.status === 'pending'}
                >
                  {i18n('icu:stickers--StickerManager--Install')}
                </AxoDialog.Action>
              )}
            </AxoDialog.Actions>
          </AxoDialog.Footer>
        </AxoDialog.Content>
      </AxoDialog.Root>

      <AxoConfirmDialog.Root
        open={confirmingUninstall}
        onOpenChange={setConfirmingUninstall}
        // @ts-expect-error ConfirmationDialog migration: Needs title
        title={null}
        description={i18n('icu:stickers--StickerManager--UninstallWarning')}
      >
        <AxoConfirmDialog.Cancel />
        <AxoConfirmDialog.Action
          variant="destructive"
          onClick={handleUninstall}
        >
          {i18n('icu:stickers--StickerManager--Uninstall')}
        </AxoConfirmDialog.Action>
      </AxoConfirmDialog.Root>
    </>
  );
});
