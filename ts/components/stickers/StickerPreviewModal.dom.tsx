// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  memo,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type JSX,
  useRef,
  useId,
} from 'react';
import { Dialog as RadixDialog } from 'radix-ui';
import { Popover } from 'react-aria-components';

import type { LocalizerType } from '../../types/Util.std.ts';
import type {
  StickerPackType,
  StickerType,
} from '../../state/ducks/stickers.preload.ts';
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
import { useRestoreFocus } from '../../hooks/useRestoreFocus.dom.ts';
import type { StickerReferenceType } from '../../types/Stickers.preload.ts';
import { AxoItem } from '../../axo/items/AxoItem.dom.tsx';
import { AriaClickable } from '../../axo/AriaClickable.dom.tsx';

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
  markStickerAsFavorite: (
    stickerRef: StickerReferenceType,
    markAsFavorite: boolean
  ) => void;
  uninstallStickerPack: (
    packId: string,
    packKey: string,
    options: { actionSource: 'ui' }
  ) => void;
  showToast: ShowToastAction;
  pack?: StickerPackType;
  favoriteStickers: ReadonlyArray<StickerType>;
  i18n: LocalizerType;
  isFavoriteStickersEnabled: boolean;
}>;

function renderBody({
  pack,
  favoriteStickerIdsSet,
  i18n,
  isFavoriteStickersEnabled,
  handleCopyLink,
  handleStartUninstall,
  markStickerAsFavorite,
}: Pick<
  Props,
  'i18n' | 'isFavoriteStickersEnabled' | 'markStickerAsFavorite' | 'pack'
> & {
  favoriteStickerIdsSet: Set<number>;
  handleCopyLink: () => void;
  handleStartUninstall: () => void;
}) {
  if (pack == null) {
    return null;
  }

  if (pack.status === 'error') {
    return (
      <div className={tw('py-6 text-center text-destructive')}>
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
    <>
      {pack.cover && (
        <div className={tw('flex justify-center')}>
          <img
            className={tw(
              'mb-4 aspect-square max-h-20 w-full max-w-20 object-contain'
            )}
            src={pack.cover.url}
            alt={pack.title}
          />
        </div>
      )}
      <div className={tw('text-center')}>
        <h2 className={tw('mb-2 type-title-medium text-primary')}>
          <UserText text={pack.title} />
          {pack.isBlessed && (
            <span className={tw('ms-1.5')}>
              <OfficialChatInlineBadge />
            </span>
          )}
        </h2>
        <div className={tw('mb-3 text-secondary')}>
          <div>{pack.author}</div>
          <div>
            {i18n('icu:stickers--StickerPreview--StickerCount', {
              count: pack.stickerCount,
            })}
          </div>
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
          'mt-4 mb-1 grid w-max max-w-full grid-cols-5 items-center justify-center gap-2.5'
        )}
      >
        {pack.stickers.map(sticker => (
          <StickerButton
            key={sticker.id}
            sticker={sticker}
            pack={pack}
            i18n={i18n}
            favoriteStickerIdsSet={favoriteStickerIdsSet}
            isFavoriteStickersEnabled={isFavoriteStickersEnabled}
            markStickerAsFavorite={markStickerAsFavorite}
          />
        ))}
        {Array.from({ length: placeholders }, (_, index) => {
          return (
            <div
              key={index}
              className={tw(
                'aspect-square max-h-18 w-full max-w-18 rounded-md bg-primary'
              )}
            />
          );
        })}
      </div>
    </>
  );
}

type StickerButtonProps = Pick<
  Props,
  'i18n' | 'isFavoriteStickersEnabled' | 'markStickerAsFavorite'
> & {
  favoriteStickerIdsSet: Set<number>;
  pack: StickerPackType;
  sticker: StickerType;
};

const StickerButton = memo(function StickerButton(
  props: StickerButtonProps
): JSX.Element {
  const {
    favoriteStickerIdsSet,
    i18n,
    isFavoriteStickersEnabled,
    markStickerAsFavorite,
    pack,
    sticker,
  } = props;

  const { id: packId } = pack;
  const { id: stickerId, url, emoji } = sticker;

  const isFavorite = favoriteStickerIdsSet.has(stickerId);
  const canAddFavorite = pack.status === 'installed';

  const favoriteButtonLabelId = useId();
  const popoverTriggerRef = useRef<HTMLButtonElement>(null);

  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const handleFavoriteSticker = useCallback(() => {
    markStickerAsFavorite({ packId, stickerId }, !isFavorite);
    setIsPopoverOpen(false);
  }, [isFavorite, packId, stickerId, markStickerAsFavorite]);

  const handlePopoverOpenChange = useCallback((open: boolean) => {
    setIsPopoverOpen(open);
  }, []);

  if (!isFavoriteStickersEnabled) {
    return (
      <img
        className={tw('aspect-square max-h-18 w-full max-w-18 object-contain')}
        src={url}
        alt={
          emoji ?? i18n('icu:stickers--StickerPreview--StickerNoEmojiAriaLabel')
        }
      />
    );
  }

  return (
    <div key={stickerId} className={tw('relative')}>
      <AriaClickable.Root
        className={tw('legacy-z-index-base data-focused:axo-focus-ring')}
      >
        <img
          className={tw(
            'aspect-square max-h-18 w-full max-w-18 object-contain'
          )}
          src={url}
          alt={
            emoji ??
            i18n('icu:stickers--StickerPreview--StickerNoEmojiAriaLabel')
          }
        />
        <AriaClickable.HiddenTrigger
          onClick={() => setIsPopoverOpen(true)}
          label={i18n('icu:stickers--StickerPreview--SeeStickerDetails')}
          ref={popoverTriggerRef}
        />
      </AriaClickable.Root>

      {isPopoverOpen && (
        <div className={tw('absolute -inset-1.25 rounded-2xl bg-secondary')} />
      )}

      {/* We wrap React Aria's Popover with a "dummy" RadixDialog to help them play nicely together.
      See DatePicker for more info. */}
      <RadixDialog.Root open={isPopoverOpen} modal>
        <RadixDialog.Overlay asChild>{null}</RadixDialog.Overlay>
        <RadixDialog.Content
          asChild
          aria-labelledby={undefined}
          data-state={undefined}
        >
          <Popover
            className={tw(
              'w-74 rounded-3xl p-2',
              'bg-surface-tertiary shadow-elevation-2',
              'overflow-x-hidden overflow-y-auto',
              'focus-visible:outline-none data-focus-visible:axo-focus-ring'
            )}
            isOpen={isPopoverOpen}
            onOpenChange={handlePopoverOpenChange}
            triggerRef={popoverTriggerRef}
            placement="top"
            offset={11}
          >
            <RadixDialog.Title className={tw('sr-only')}>
              {i18n('icu:stickers--StickerPreview--StickerDetailsTitle')}
            </RadixDialog.Title>
            <div className={tw('flex max-w-full flex-col items-center')}>
              <img
                key={stickerId}
                className={tw(
                  'aspect-square max-h-64 w-full max-w-64 object-contain'
                )}
                src={url}
                alt={
                  emoji ??
                  i18n('icu:stickers--StickerPreview--StickerNoEmojiAriaLabel')
                }
              />
              <div className={tw('mt-1 mb-3.5 type-body-small text-secondary')}>
                <UserText text={pack.title} />
                <span>&nbsp;·&nbsp;</span>
                <UserText text={pack.author} />
              </div>
              <AxoItem.Group>
                {isFavorite && (
                  <AxoItem.Root>
                    <AxoItem.Leading>
                      <span className={tw('ps-2')}>
                        <AxoItem.Icon symbol="star-slash" />
                      </span>
                    </AxoItem.Leading>
                    <AxoItem.Content>
                      <AxoItem.Label id={favoriteButtonLabelId}>
                        {i18n('icu:stickers--StickerPreview--RemoveFavorite')}
                      </AxoItem.Label>
                      <AxoItem.HiddenTrigger
                        labelledby={favoriteButtonLabelId}
                        onClick={handleFavoriteSticker}
                      />
                    </AxoItem.Content>
                  </AxoItem.Root>
                )}
                {!isFavorite && canAddFavorite && (
                  <AxoItem.Root>
                    <AxoItem.Leading>
                      <span className={tw('ps-2')}>
                        <AxoItem.Icon symbol="star" />
                      </span>
                    </AxoItem.Leading>
                    <AxoItem.Content>
                      <AxoItem.Label id={favoriteButtonLabelId}>
                        {i18n('icu:stickers--StickerPreview--AddFavorite')}
                      </AxoItem.Label>
                      <AxoItem.HiddenTrigger
                        labelledby={favoriteButtonLabelId}
                        onClick={handleFavoriteSticker}
                      />
                    </AxoItem.Content>
                  </AxoItem.Root>
                )}
              </AxoItem.Group>
            </div>
          </Popover>
        </RadixDialog.Content>
      </RadixDialog.Root>
    </div>
  );
});

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
  favoriteStickers,
  i18n,
  installStickerPack,
  isFavoriteStickersEnabled,
  markStickerAsFavorite,
  onClose,
  pack,
  showToast,
  uninstallStickerPack,
}: Props) {
  const [confirmingUninstall, setConfirmingUninstall] = useState(false);

  // Restore focus on teardown
  const [focusRef] = useRestoreFocus();

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

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        closeStickerPackPreview();
        onClose?.();
      }
    },
    [closeStickerPackPreview, onClose]
  );

  useEffect(() => {
    if (pack) {
      return;
    }

    // Pack fully uninstalled, don't keep the modal open
    handleOpenChange(false);
  }, [handleOpenChange, pack]);

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

  const favoriteStickerIdsSet = useMemo(() => {
    const result = new Set<number>();
    if (!pack) {
      return result;
    }

    for (const sticker of favoriteStickers) {
      if (sticker.packId === pack.id) {
        result.add(sticker.id);
      }
    }
    return result;
  }, [favoriteStickers, pack]);

  return (
    <>
      <AxoDialog.Root open onOpenChange={handleOpenChange}>
        <AxoDialog.Content
          size="md"
          escape="cancel-is-noop"
          disableMissingAriaDescriptionWarning
        >
          <AxoDialog.Header floating>
            <AxoDialog.Title>
              {i18n('icu:stickers--StickerPreview--Title')}
            </AxoDialog.Title>
            <AxoDialog.Close />
          </AxoDialog.Header>
          <AxoDialog.Body>
            <div ref={focusRef} />
            {renderBody({
              pack,
              favoriteStickerIdsSet,
              i18n,
              isFavoriteStickersEnabled,
              handleCopyLink,
              handleStartUninstall,
              markStickerAsFavorite,
            })}
          </AxoDialog.Body>
          <AxoDialog.Footer>
            <AxoDialog.Actions>
              {isInstallFooterVisible(pack) && (
                <AxoDialog.Action
                  variant="strong-primary"
                  onClick={handleInstall}
                  pending={pack.status === 'pending'}
                >
                  {i18n('icu:stickers--StickerPreview--Install')}
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
          variant="strong-destructive"
          onClick={handleUninstall}
        >
          {i18n('icu:stickers--StickerManager--Uninstall')}
        </AxoConfirmDialog.Action>
      </AxoConfirmDialog.Root>
    </>
  );
});
