import * as React from 'react';
import { createPortal } from 'react-dom';
import { StickerPackInstallButton } from './StickerPackInstallButton';
import { ConfirmationDialog } from '../ConfirmationDialog';
import { LocalizerType } from '../../types/Util';
import { StickerPackType } from '../../state/ducks/stickers';

export type OwnProps = {
  readonly onClose: () => unknown;
  readonly installStickerPack: (packId: string, packKey: string) => unknown;
  readonly uninstallStickerPack: (packId: string, packKey: string) => unknown;
  readonly pack: StickerPackType;
  readonly i18n: LocalizerType;
};

export type Props = OwnProps;

function focusRef(el: HTMLElement | null) {
  if (el) {
    el.focus();
  }
}

export const StickerPreviewModal = React.memo(
  // tslint:disable-next-line max-func-body-length
  ({
    onClose,
    pack,
    i18n,
    installStickerPack,
    uninstallStickerPack,
  }: Props) => {
    const [root, setRoot] = React.useState<HTMLElement | null>(null);
    const [confirmingUninstall, setConfirmingUninstall] = React.useState(false);

    React.useEffect(() => {
      const div = document.createElement('div');
      document.body.appendChild(div);
      setRoot(div);

      return () => {
        document.body.removeChild(div);
        setRoot(null);
      };
    }, []);

    const isInstalled = pack.status === 'installed';
    const handleToggleInstall = React.useCallback(
      () => {
        if (isInstalled) {
          setConfirmingUninstall(true);
        } else {
          installStickerPack(pack.id, pack.key);
          onClose();
        }
      },
      [isInstalled, pack, setConfirmingUninstall, installStickerPack, onClose]
    );

    const handleUninstall = React.useCallback(
      () => {
        uninstallStickerPack(pack.id, pack.key);
        setConfirmingUninstall(false);
        // onClose is called by the confirmation modal
      },
      [uninstallStickerPack, setConfirmingUninstall, pack]
    );

    React.useEffect(
      () => {
        const handler = ({ key }: KeyboardEvent) => {
          if (key === 'Escape') {
            onClose();
          }
        };

        document.addEventListener('keyup', handler);

        return () => {
          document.removeEventListener('keyup', handler);
        };
      },
      [onClose]
    );

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
          <div
            role="button"
            className="module-sticker-manager__preview-modal__overlay"
            onClick={handleClickToClose}
          >
            {confirmingUninstall ? (
              <ConfirmationDialog
                i18n={i18n}
                onClose={onClose}
                negativeText={i18n('stickers--StickerManager--Uninstall')}
                onNegative={handleUninstall}
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
                    onClick={onClose}
                    className="module-sticker-manager__preview-modal__container__header__close-button"
                  />
                </header>
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
                </div>
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
                    <StickerPackInstallButton
                      ref={focusRef}
                      installed={isInstalled}
                      i18n={i18n}
                      onClick={handleToggleInstall}
                      blue={true}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>,
          root
        )
      : null;
  }
);
