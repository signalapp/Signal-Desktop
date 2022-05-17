import React, { useEffect, useRef } from 'react';
import classNames from 'classnames';

import { SessionIconButton } from './icon/';

// tslint:disable-next-line: no-submodule-imports
import useKey from 'react-use/lib/useKey';
import { SessionButton } from './basic/SessionButton';

export type SessionWrapperModalType = {
  title?: string;
  showHeader?: boolean;
  onConfirm?: () => void;
  onClose?: () => void;
  showClose?: boolean;
  confirmText?: string;
  cancelText?: string;
  showExitIcon?: boolean;
  headerIconButtons?: Array<any>;
  children: any;
  headerReverse?: boolean;
  additionalClassName?: string;
};

export const SessionWrapperModal = (props: SessionWrapperModalType) => {
  const {
    title,
    onConfirm,
    onClose,
    showHeader = true,
    showClose = false,
    confirmText,
    cancelText,
    showExitIcon,
    headerIconButtons,
    headerReverse,
    additionalClassName,
  } = props;

  useKey(
    'Esc',
    () => {
      props.onClose?.();
    },
    undefined,
    [props.onClose]
  );

  useKey(
    'Escape',
    () => {
      props.onClose?.();
    },
    undefined,
    [props.onClose]
  );

  const modalRef = useRef<HTMLDivElement>(null);

  const handleClick = (e: any) => {
    if (!modalRef.current?.contains(e.target)) {
      props.onClose?.();
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClick);

    return () => {
      document.removeEventListener('mousedown', handleClick);
    };
  }, []);

  return (
    <div
      className={classNames('loki-dialog modal', additionalClassName ? additionalClassName : null)}
    >
      <div className="session-confirm-wrapper">
        <div ref={modalRef} className="session-modal">
          {showHeader ? (
            <div className={classNames('session-modal__header', headerReverse && 'reverse')}>
              <div className="session-modal__header__close">
                {showExitIcon ? (
                  <SessionIconButton
                    iconType="exit"
                    iconSize="small"
                    onClick={props.onClose}
                    dataTestId="modal-close-button"
                  />
                ) : null}
              </div>
              <div className="session-modal__header__title">{title}</div>
              <div className="session-modal__header__icons">
                {headerIconButtons
                  ? headerIconButtons.map((iconItem: any) => {
                      return (
                        <SessionIconButton
                          key={iconItem.iconType}
                          iconType={iconItem.iconType}
                          iconSize={'large'}
                          iconRotation={iconItem.iconRotation}
                          onClick={iconItem.onClick}
                        />
                      );
                    })
                  : null}
              </div>
            </div>
          ) : null}

          <div className="session-modal__body">
            <div className="session-modal__centered">
              {props.children}

              <div className="session-modal__button-group">
                {onClose && showClose ? (
                  <SessionButton onClick={props.onClose}>
                    {cancelText || window.i18n('close')}
                  </SessionButton>
                ) : null}
                {onConfirm ? (
                  <SessionButton onClick={props.onConfirm}>
                    {confirmText || window.i18n('ok')}
                  </SessionButton>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
