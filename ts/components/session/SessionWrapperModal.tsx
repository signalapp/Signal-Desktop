import React, { useEffect } from 'react';
import classNames from 'classnames';

import { SessionIconButton, SessionIconSize, SessionIconType } from './icon/';
import { SessionButton, SessionButtonColor, SessionButtonType } from './SessionButton';
import { DefaultTheme } from 'styled-components';

import { useKeyPress } from 'use-hooks';

interface Props {
  title: string;
  onClose: any;
  showExitIcon?: boolean;
  showHeader?: boolean;
  headerReverse?: boolean;
  //Maximum of two icons or buttons in header
  headerIconButtons?: Array<{
    iconType: SessionIconType;
    iconRotation: number;
    onClick?: any;
  }>;
  headerButtons?: Array<{
    buttonType: SessionButtonType;
    buttonColor: SessionButtonColor;
    text: string;
    onClick?: any;
  }>;
  theme: DefaultTheme;
}

export type SessionWrapperModalType = {
  title?: string;
  onConfirm?: () => void;
  onClose?: () => void;
  showClose?: boolean
  confirmText?: string;
  cancelText?: string;
  showExitIcon?: boolean;
  theme?: any;
  headerIconButtons?: any[];
  children: any;
  headerReverse?: boolean;
};

export const SessionWrapperModal = (props: SessionWrapperModalType) => {
  const {
    title,
    onConfirm,
    onClose,
    showClose = false,
    confirmText,
    cancelText,
    showExitIcon,
    theme,
    headerIconButtons,
    headerReverse
  } = props;

  useEffect(() => {
    window.addEventListener('keyup', upHandler);

    return () => {
      window.removeEventListener('keyup', upHandler);
    };
  }, []);

  // TODO: warrick: typing
  const upHandler = ({ key }: any) => {
    if (key === 'Escape') {
      if (props.onClose) {
        props.onClose();
      }
    }
  };

  return (
    <div className="loki-dialog session-confirm-wrapper modal">
      <div className="session-confirm-wrapper">
        <div className="session-modal">
          <div className={classNames('session-modal__header', headerReverse && 'reverse')}>
            <div className="session-modal__header__close">
              {showExitIcon ? (
                <SessionIconButton
                  iconType={SessionIconType.Exit}
                  iconSize={SessionIconSize.Small}
                  onClick={props.onClose}
                  theme={props.theme}
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
                        iconSize={SessionIconSize.Large}
                        iconRotation={iconItem.iconRotation}
                        onClick={iconItem.onClick}
                        theme={props.theme}
                      />
                    );
                  })
                : null}
            </div>
          </div>
          <div className="session-modal__body">
            <div className="session-modal__centered">
              {props.children}
              <div className="session-modal__button-group">
                {onConfirm ? (
                  <SessionButton onClick={props.onConfirm}>
                    {confirmText || window.i18n('ok')}
                  </SessionButton>
                ) : null}
                {onClose && showClose ? (
                  <SessionButton onClick={props.onClose}>
                    {cancelText || window.i18n('close')}
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
