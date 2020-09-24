import * as React from 'react';
import classNames from 'classnames';
import { LocalizerType } from '../types/Util';

export type ActionSpec = {
  text: string;
  action: () => unknown;
  style?: 'affirmative' | 'negative';
};

export type OwnProps = {
  readonly i18n: LocalizerType;
  readonly children: React.ReactNode;
  readonly title?: string | React.ReactNode;
  readonly actions: Array<ActionSpec>;
  readonly onClose: () => unknown;
};

export type Props = OwnProps;

function focusRef(el: HTMLElement | null) {
  if (el) {
    el.focus();
  }
}

export const ConfirmationDialog = React.memo(
  ({ i18n, onClose, children, title, actions }: Props) => {
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

    const handleCancel = React.useCallback(
      (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      },
      [onClose]
    );

    const handleAction = React.useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        onClose();
        if (e.currentTarget.dataset.action) {
          const actionIndex = parseInt(e.currentTarget.dataset.action, 10);
          const { action } = actions[actionIndex];
          action();
        }
      },
      [onClose, actions]
    );

    return (
      <div className="module-confirmation-dialog__container">
        {title ? (
          <h1 className="module-confirmation-dialog__container__title">
            {title}
          </h1>
        ) : null}
        <div className="module-confirmation-dialog__container__content">
          {children}
        </div>
        {actions.length > 0 && (
          <div className="module-confirmation-dialog__container__buttons">
            <button
              type="button"
              onClick={handleCancel}
              ref={focusRef}
              className="module-confirmation-dialog__container__buttons__button"
            >
              {i18n('confirmation-dialog--Cancel')}
            </button>
            {actions.map((action, i) => (
              <button
                type="button"
                key={action.text}
                onClick={handleAction}
                data-action={i}
                className={classNames(
                  'module-confirmation-dialog__container__buttons__button',
                  action.style === 'affirmative'
                    ? 'module-confirmation-dialog__container__buttons__button--affirmative'
                    : null,
                  action.style === 'negative'
                    ? 'module-confirmation-dialog__container__buttons__button--negative'
                    : null
                )}
              >
                {action.text}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }
);
