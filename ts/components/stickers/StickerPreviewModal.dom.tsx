// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { memo, useState, useEffect, useCallback } from 'react';
import type { LocalizerType } from '../../types/Util.std.ts';
import type { StickerPackType } from '../../state/ducks/stickers.preload.ts';
import type { ShowToastAction } from '../../state/ducks/toast.preload.ts';
import { UserText } from '../UserText.dom.tsx';
import { AxoConfirmDialog } from '../../axo/AxoConfirmDialog.dom.tsx';
import { AxoDialog } from '../../axo/AxoDialog.dom.tsx';
import { tw } from '../../axo/tw.dom.tsx';
import { AxoStackedButton } from '../../axo/AxoStackedButton.dom.tsx';
import { SpinnerV2 } from '../SpinnerV2.dom.tsx';
import { OfficialChatInlineBadge } from '../conversation/OfficialChatInlineBadge.dom.tsx';
import { artAddStickersRoute } from '../../util/signalRoutes.std.ts';
import { drop } from '../../util/drop.std.ts';
import { ToastType } from '../../types/Toast.dom.tsx';
import { fromBase64PackKeyToHex } from '../../util/Stickers.std.ts';

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
  showToast: ShowToastAction;
  pack?: StickerPackType;
  i18n: LocalizerType;
}>;

function renderBody({
  pack,
  i18n,
  handleCopyLink,
  handleStartUninstall,
}: Pick<Props, 'i18n' | 'pack'> & {
  handleCopyLink: () => void;
  handleStartUninstall: () => void;
}) {
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
    <div className={tw('justify-items-center')}>
      {pack.cover && (
        <img
          className={tw(
            'mb-4 aspect-square max-h-20 w-full max-w-20 object-contain'
          )}
          src={pack.cover.url}
          alt={pack.title}
        />
      )}
      <h2 className={tw('mb-2 type-title-medium')}>
        <UserText text={pack.title} />
        {pack.isBlessed && (
          <span className={tw('ms-1.5')}>
            <OfficialChatInlineBadge />
          </span>
        )}
      </h2>
      <div
        className={tw(
          'mb-3 justify-items-center type-body-medium text-label-secondary'
        )}
      >
        <div>{pack.author}</div>
        <div>
          {i18n('icu:stickers--StickerPreview--StickerCount', {
            count: pack.stickerCount,
          })}
        </div>
      </div>
      <AxoStackedButton.Row spacing="md">
        <AxoStackedButton.Root
          symbol="link"
          label={i18n('icu:stickers--StickerPreview--Link')}
          onClick={handleCopyLink}
        />
        {pack.status === 'installed' && (
          <AxoStackedButton.Root
            symbol="minus-circle"
            label={i18n('icu:stickers--StickerPreview--Remove')}
            onClick={handleStartUninstall}
          />
        )}
      </AxoStackedButton.Row>
      <div
        className={tw(
          'mt-4 grid w-max grid-cols-5 items-center justify-center gap-2.5'
        )}
      >
        {pack.stickers.map(({ emoji, id, url }) => (
          <img
            key={id}
            className={tw(
              'aspect-square max-h-18 w-full max-w-18 object-contain'
            )}
            src={url}
            alt={
              emoji ??
              i18n('icu:stickers--StickerPreview--StickerNoEmojiAriaLabel')
            }
          />
        ))}
        {Array.from({ length: placeholders }, (_, index) => {
          return (
            <div
              key={index}
              className={tw(
                'aspect-square max-h-18 w-full max-w-18 rounded-md bg-fill-secondary'
              )}
            />
          );
        })}
      </div>
    </div>
  );
}

function isInstallFooterVisible(
  pack: StickerPackType | undefined
): pack is StickerPackType {
  return Boolean(
    pack &&
    pack.status != null &&
    pack.status !== 'error' &&
    pack.status !== 'installed'
  );
}

export const StickerPreviewModal = memo(function StickerPreviewModalInner({
  closeStickerPackPreview,
  downloadStickerPack,
  i18n,
  installStickerPack,
  onClose,
  pack,
  showToast,
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
  }, [downloadStickerPack, installStickerPack, pack]);

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

  const handleCopyLink = useCallback(() => {
    if (!pack) {
      return;
    }

    const link = artAddStickersRoute
      .toWebUrl({
        packId: pack.id,
        packKey: fromBase64PackKeyToHex(pack.key),
      })
      .toString();
    drop(window.navigator.clipboard.writeText(link));
    showToast({ toastType: ToastType.CopiedStickerPackLink });
  }, [pack, showToast]);

  return (
    <>
      <AxoDialog.Root open onOpenChange={handleClose}>
        <AxoDialog.Content size="md" escape="cancel-is-noop">
          <AxoDialog.Header>
            <AxoDialog.Title screenReaderOnly>
              {i18n('icu:stickers--StickerPreview--Title')}
            </AxoDialog.Title>
            <AxoDialog.Close />
          </AxoDialog.Header>
          <AxoDialog.Body>
            {renderBody({ pack, i18n, handleCopyLink, handleStartUninstall })}
          </AxoDialog.Body>
          <AxoDialog.Footer>
            {isInstallFooterVisible(pack) && (
              <AxoDialog.Action
                variant="primary"
                onClick={handleInstall}
                pending={pack.status === 'pending'}
              >
                {i18n('icu:stickers--StickerPreview--Install')}
              </AxoDialog.Action>
            )}
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
