// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { createPortal } from 'react-dom';
import { isNumber, range } from 'lodash';
import classNames from 'classnames';
import { StickerPackInstallButton } from './StickerPackInstallButton';
import { ConfirmationDialog } from '../ConfirmationDialog';
import type { LocalizerType } from '../../types/Util';
import type { StickerPackType } from '../../state/ducks/stickers';
import { Spinner } from '../Spinner';
import { useRestoreFocus } from '../../hooks/useRestoreFocus';

export type OwnProps = {
  readonly onClose: () => unknown;
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
      <div className="module-sticker-manager__preview-modal__container__error">
        {i18n('stickers--StickerPreview--Error')}
      </div>
    );
  }

  if (pack.stickerCount === 0 || !isNumber(pack.stickerCount)) {
    return <Spinner svgSize="normal" />;
  }

  return (
    <div className="module-sticker-manager__preview-modal__container__sticker-grid">
      {pack.stickers.map(({ id, url }) => (
        <div
          key={id}
          className="module-sticker-manager__preview-modal__container__sticker-grid__cell"
        >
          <img
            className="module-sticker-manager__preview-modal__container__sticker-grid__cell__image"
            src={url}
            alt={pack.title}
          />
        </div>
      ))}
      {pack.status === 'pending' &&
        range(pack.stickerCount - pack.stickers.length).map(i => (
          <div
            key={`placeholder-${i}`}
            className={classNames(
              'module-sticker-manager__preview-modal__container__sticker-grid__cell',
              'module-sticker-manager__preview-modal__container__sticker-grid__cell--placeholder'
            )}
          />
        ))}
    </div>
  );
}

export const StickerPreviewModal = React.memo((props: Props) => {
  const {
    onClose,
    pack,
    i18n,
    downloadStickerPack,
    installStickerPack,
    uninstallStickerPack,
  } = props;
  const [root, setRoot] = React.useState<HTMLElement | null>(null);
  const [confirmingUninstall, setConfirmingUninstall] = React.useState(false);

  // Restore focus on teardown
  const [focusRef] = useRestoreFocus();

  React.useEffect(() => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    setRoot(div);

    return () => {
      document.body.removeChild(div);
    };
  }, []);

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

  React.useEffect(() => {
    if (!pack) {
      onClose();
    }
  }, [pack, onClose]);

  const isInstalled = Boolean(pack && pack.status === 'installed');
  const handleToggleInstall = React.useCallback(() => {
    if (!pack) {
      return;
    }
    if (isInstalled) {
      setConfirmingUninstall(true);
    } else if (pack.status === 'ephemeral') {
      downloadStickerPack(pack.id, pack.key, { finalStatus: 'installed' });
      onClose();
    } else {
      installStickerPack(pack.id, pack.key);
      onClose();
    }
  }, [
    downloadStickerPack,
    installStickerPack,
    isInstalled,
    onClose,
    pack,
    setConfirmingUninstall,
  ]);

  const handleUninstall = React.useCallback(() => {
    if (!pack) {
      return;
    }
    uninstallStickerPack(pack.id, pack.key);
    setConfirmingUninstall(false);
    // onClose is called by <ConfirmationDialog />
  }, [uninstallStickerPack, setConfirmingUninstall, pack]);

  React.useEffect(() => {
    const handler = ({ key }: KeyboardEvent) => {
      if (key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handler);

    return () => {
      document.removeEventListener('keydown', handler);
    };
  }, [onClose]);

  const handleClickToClose = React.useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  return root
    ? createPortal(
        // Not really a button. Just a background which can be clicked to close modal
        // eslint-disable-next-line max-len
        // eslint-disable-next-line jsx-a11y/interactive-supports-focus, jsx-a11y/click-events-have-key-events
        <div
          role="button"
          className="module-sticker-manager__preview-modal__overlay"
          onClick={handleClickToClose}
        >
          {confirmingUninstall ? (
            <ConfirmationDialog
              i18n={i18n}
              onClose={onClose}
              actions={[
                {
                  style: 'negative',
                  text: i18n('stickers--StickerManager--Uninstall'),
                  action: handleUninstall,
                },
              ]}
            >
              {i18n('stickers--StickerManager--UninstallWarning')}
            </ConfirmationDialog>
          ) : (
            <div className="module-sticker-manager__preview-modal__container">
              <header className="module-sticker-manager__preview-modal__container__header">
                <h2 className="module-sticker-manager__preview-modal__container__header__text">
                  {i18n('stickers--StickerPreview--Title')}
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  className="module-sticker-manager__preview-modal__container__header__close-button"
                  aria-label={i18n('close')}
                />
              </header>
              {renderBody(props)}
              {pack && pack.status !== 'error' ? (
                <div className="module-sticker-manager__preview-modal__container__meta-overlay">
                  <div className="module-sticker-manager__preview-modal__container__meta-overlay__info">
                    <h3 className="module-sticker-manager__preview-modal__container__meta-overlay__info__title">
                      {pack.title}
                      {pack.isBlessed ? (
                        <span className="module-sticker-manager__preview-modal__container__meta-overlay__info__blessed-icon" />
                      ) : null}
                    </h3>
                    <h4 className="module-sticker-manager__preview-modal__container__meta-overlay__info__author">
                      {pack.author}
                    </h4>
                  </div>
                  <div className="module-sticker-manager__preview-modal__container__meta-overlay__install">
                    {pack.status === 'pending' ? (
                      <Spinner svgSize="small" size="14px" />
                    ) : (
                      <StickerPackInstallButton
                        ref={focusRef}
                        installed={isInstalled}
                        i18n={i18n}
                        onClick={handleToggleInstall}
                        blue
                      />
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>,
        root
      )
    : null;
});
