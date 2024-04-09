import classNames from 'classnames';
import React, { useRef } from 'react';
import useKey from 'react-use/lib/useKey';

import { SessionIconButton } from './icon';

import { SessionButton, SessionButtonColor, SessionButtonType } from './basic/SessionButton';
import { SessionFocusTrap } from './SessionFocusTrap';

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
  children: React.ReactNode;
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

  return (
    <SessionFocusTrap>
      <div
        className={classNames('loki-dialog modal', additionalClassName || null)}
        onClick={handleClick}
        role="dialog"
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
                  {onConfirm ? (
                    <SessionButton buttonType={SessionButtonType.Simple} onClick={props.onConfirm}>
                      {confirmText || window.i18n('ok')}
                    </SessionButton>
                  ) : null}
                  {onClose && showClose ? (
                    <SessionButton
                      buttonType={SessionButtonType.Simple}
                      buttonColor={SessionButtonColor.Danger}
                      onClick={props.onClose}
                    >
                      {cancelText || window.i18n('close')}
                    </SessionButton>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SessionFocusTrap>
  );
};
