import * as React from 'react';
import classNames from 'classnames';
import { LocalizerType } from '../types/Util';

export type OwnProps = {
  readonly i18n: LocalizerType;
  readonly children: React.ReactNode;
  readonly affirmativeText?: string;
  readonly onAffirmative?: () => unknown;
  readonly onClose: () => unknown;
  readonly negativeText?: string;
  readonly onNegative?: () => unknown;
};

export type Props = OwnProps;

function focusRef(el: HTMLElement | null) {
  if (el) {
    el.focus();
  }
}

export const ConfirmationDialog = React.memo(
  ({
    i18n,
    onClose,
    children,
    onAffirmative,
    onNegative,
    affirmativeText,
    negativeText,
  }: Props) => {
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

    const handleCancel = React.useCallback(
      (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      },
      [onClose]
    );

    const handleNegative = React.useCallback(
      () => {
        onClose();
        if (onNegative) {
          onNegative();
        }
      },
      [onClose, onNegative]
    );

    const handleAffirmative = React.useCallback(
      () => {
        onClose();
        if (onAffirmative) {
          onAffirmative();
        }
      },
      [onClose, onAffirmative]
    );

    return (
      <div className="module-confirmation-dialog__container">
        <div className="module-confirmation-dialog__container__content">
          {children}
        </div>
        <div className="module-confirmation-dialog__container__buttons">
          <button
            onClick={handleCancel}
            ref={focusRef}
            className="module-confirmation-dialog__container__buttons__button"
          >
            {i18n('confirmation-dialog--Cancel')}
          </button>
          {onNegative && negativeText ? (
            <button
              onClick={handleNegative}
              className={classNames(
                'module-confirmation-dialog__container__buttons__button',
                'module-confirmation-dialog__container__buttons__button--negative'
              )}
            >
              {negativeText}
            </button>
          ) : null}
          {onAffirmative && affirmativeText ? (
            <button
              onClick={handleAffirmative}
              className={classNames(
                'module-confirmation-dialog__container__buttons__button',
                'module-confirmation-dialog__container__buttons__button--affirmative'
              )}
            >
              {affirmativeText}
            </button>
          ) : null}
        </div>
      </div>
    );
  }
);
