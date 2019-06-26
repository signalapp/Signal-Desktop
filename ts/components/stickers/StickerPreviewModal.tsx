import * as React from 'react';
import { createPortal } from 'react-dom';
import { isNumber, range } from 'lodash';
import classNames from 'classnames';
import { StickerPackInstallButton } from './StickerPackInstallButton';
import { ConfirmationDialog } from '../ConfirmationDialog';
import { LocalizerType } from '../../types/Util';
import { StickerPackType } from '../../state/ducks/stickers';
import { Spinner } from '../Spinner';

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

function focusRef(el: HTMLElement | null) {
  if (el) {
    el.focus();
  }
}

function renderBody({ pack, i18n }: Props) {
  if (pack && pack.status === 'error') {
    return (
      <div className="module-sticker-manager__preview-modal__container__error">
        {i18n('stickers--StickerPreview--Error')}
      </div>
    );
  }

  if (!pack || pack.stickerCount === 0 || !isNumber(pack.stickerCount)) {
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
      {range(pack.stickerCount - pack.stickers.length).map(i => (
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

export const StickerPreviewModal = React.memo(
  // tslint:disable-next-line max-func-body-length
  (props: Props) => {
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
    }, []);

    const isInstalled = Boolean(pack && pack.status === 'installed');
    const handleToggleInstall = React.useCallback(
      () => {
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
      },
      [isInstalled, pack, setConfirmingUninstall, installStickerPack, onClose]
    );

    const handleUninstall = React.useCallback(
      () => {
        if (!pack) {
          return;
        }
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
                          blue={true}
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
  }
);
