// Copyright 2019-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { isNumber, range } from 'lodash';
import classNames from 'classnames';
import { ConfirmationDialog } from '../ConfirmationDialog';
import type { LocalizerType } from '../../types/Util';
import type { StickerPackType } from '../../state/ducks/stickers';
import { Spinner } from '../Spinner';
import { useRestoreFocus } from '../../hooks/useRestoreFocus';
import { Modal } from '../Modal';
import { Button, ButtonVariant } from '../Button';

export type OwnProps = {
  readonly onClose?: () => unknown;
  readonly closeStickerPackPreview: (packId: string) => unknown;
  readonly downloadStickerPack: (
    packId: string,
    packKey: string,
    options?: { finalStatus?: 'installed' | 'downloaded' }
  ) => unknown;
  readonly installStickerPack: (packId: string, packKey: string) => unknown;
  readonly uninstallStickerPack: (packId: string, packKey: string) => unknown;
  readonly pack?: StickerPackType;
  readonly i18n: LocalizerType;
};

export type Props = OwnProps;

function renderBody({ pack, i18n }: Props) {
  if (!pack) {
    return null;
  }

  if (pack && pack.status === 'error') {
    return (
      <div className="module-sticker-manager__preview-modal__error">
        {i18n('stickers--StickerPreview--Error')}
      </div>
    );
  }

  if (pack.stickerCount === 0 || !isNumber(pack.stickerCount)) {
    return <Spinner svgSize="normal" />;
  }

  return (
    <div className="module-sticker-manager__preview-modal__sticker-grid">
      {pack.stickers.map(({ id, url }) => (
        <div
          key={id}
          className="module-sticker-manager__preview-modal__sticker-grid__cell"
        >
          <img
            className="module-sticker-manager__preview-modal__sticker-grid__cell__image"
            src={url}
            alt={pack.title}
          />
        </div>
      ))}
      {range(pack.stickerCount - pack.stickers.length).map(i => (
        <div
          key={`placeholder-${i}`}
          className={classNames(
            'module-sticker-manager__preview-modal__sticker-grid__cell',
            'module-sticker-manager__preview-modal__sticker-grid__cell--placeholder'
          )}
        />
      ))}
    </div>
  );
}

export const StickerPreviewModal = React.memo(function StickerPreviewModalInner(
  props: Props
) {
  const {
    closeStickerPackPreview,
    downloadStickerPack,
    i18n,
    installStickerPack,
    onClose,
    pack,
    uninstallStickerPack,
  } = props;
  const [confirmingUninstall, setConfirmingUninstall] = React.useState(false);

  // Restore focus on teardown
  const [focusRef] = useRestoreFocus();

  React.useEffect(() => {
    if (pack && pack.status === 'known') {
      downloadStickerPack(pack.id, pack.key);
    }
    if (
      pack &&
      pack.status === 'error' &&
      (pack.attemptedStatus === 'downloaded' ||
        pack.attemptedStatus === 'installed')
    ) {
      downloadStickerPack(pack.id, pack.key, {
        finalStatus: pack.attemptedStatus,
      });
    }
    // We only want to attempt downloads on initial load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = React.useCallback(() => {
    if (pack?.id) {
      closeStickerPackPreview(pack.id);
    }
    onClose?.();
  }, [closeStickerPackPreview, onClose, pack]);

  const isInstalled = Boolean(pack && pack.status === 'installed');
  const handleToggleInstall = React.useCallback(() => {
    if (!pack) {
      return;
    }
    if (isInstalled) {
      setConfirmingUninstall(true);
    } else if (pack.status === 'ephemeral') {
      downloadStickerPack(pack.id, pack.key, { finalStatus: 'installed' });
      handleClose();
    } else {
      installStickerPack(pack.id, pack.key);
      handleClose();
    }
  }, [
    downloadStickerPack,
    installStickerPack,
    isInstalled,
    handleClose,
    pack,
    setConfirmingUninstall,
  ]);

  const handleUninstall = React.useCallback(() => {
    if (!pack) {
      return;
    }
    uninstallStickerPack(pack.id, pack.key);
    setConfirmingUninstall(false);
    // closeStickerPackPreview is called by <ConfirmationDialog />'s onClose
  }, [uninstallStickerPack, setConfirmingUninstall, pack]);

  const buttonLabel = isInstalled
    ? i18n('stickers--StickerManager--Uninstall')
    : i18n('stickers--StickerManager--Install');

  const modalFooter =
    pack && pack.status !== 'error' ? (
      <div className="module-sticker-manager__preview-modal__footer">
        <div className="module-sticker-manager__preview-modal__footer--info">
          <h3 className="module-sticker-manager__preview-modal__footer--title">
            {pack.title}
            {pack.isBlessed ? (
              <span className="module-sticker-manager__preview-modal__footer--blessed-icon" />
            ) : null}
          </h3>
          <h4 className="module-sticker-manager__preview-modal__footer--author">
            {pack.author}
          </h4>
        </div>
        <div className="module-sticker-manager__preview-modal__footer--install">
          {pack.status === 'pending' ? (
            <Spinner svgSize="small" size="14px" />
          ) : (
            <Button
              aria-label={buttonLabel}
              ref={focusRef}
              onClick={handleToggleInstall}
              variant={ButtonVariant.Primary}
            >
              {buttonLabel}
            </Button>
          )}
        </div>
      </div>
    ) : undefined;

  return (
    <>
      {confirmingUninstall && (
        <ConfirmationDialog
          dialogName="StickerPreviewModal.confirmUninstall"
          actions={[
            {
              style: 'negative',
              text: i18n('stickers--StickerManager--Uninstall'),
              action: handleUninstall,
            },
          ]}
          i18n={i18n}
          onClose={() => setConfirmingUninstall(false)}
        >
          {i18n('stickers--StickerManager--UninstallWarning')}
        </ConfirmationDialog>
      )}
      <Modal
        hasXButton
        i18n={i18n}
        modalFooter={modalFooter}
        modalName="StickerPreviewModal"
        moduleClassName="module-sticker-manager__preview-modal__modal"
        onClose={handleClose}
        title={i18n('stickers--StickerPreview--Title')}
      >
        {renderBody(props)}
      </Modal>
    </>
  );
});
