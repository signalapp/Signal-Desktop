import * as React from 'react';

import { LocalizerType } from '../types/Util';
import { ConfirmationModal } from './ConfirmationModal';

export type PropsType = {
  buttonText: string;
  description: string;
  title: string;

  onClose: () => void;
  i18n: LocalizerType;
};

function focusRef(el: HTMLElement | null) {
  if (el) {
    el.focus();
  }
}

export const ErrorModal = (props: PropsType): JSX.Element => {
  const { buttonText, description, i18n, onClose, title } = props;

  return (
    <ConfirmationModal
      actions={[]}
      title={title || i18n('ErrorModal--title')}
      i18n={i18n}
      onClose={onClose}
    >
      <div className="module-error-modal__description">
        {description || i18n('ErrorModal--description')}
      </div>
      <div className="module-error-modal__button-container">
        <button
          type="button"
          className="module-confirmation-dialog__container__buttons__button"
          onClick={onClose}
          ref={focusRef}
        >
          {buttonText || i18n('ErrorModal--buttonText')}
        </button>
      </div>
    </ConfirmationModal>
  );
};
