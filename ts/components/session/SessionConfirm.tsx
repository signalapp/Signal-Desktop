import React from 'react';
import { SessionModal } from './SessionModal';
import { SessionButton, SessionButtonColor } from './SessionButton';
import { SessionHtmlRenderer } from './SessionHTMLRenderer';
import { SessionIcon, SessionIconSize, SessionIconType } from './icon';
import { DefaultTheme, useTheme, withTheme } from 'styled-components';
import { SessionWrapperModal } from './SessionWrapperModal';
import { useDispatch } from 'react-redux';
import { updateConfirmModal } from '../../state/ducks/modalDialog';
import { update } from 'lodash';
import { SpacerLG } from '../basic/Text';

export interface SessionConfirmDialogProps {
  message?: string;
  messageSub?: string;
  title?: string;
  onOk?: any;
  onClose?: any;
  onClickOk?: () => any;
  onClickClose?: () => any;
  okText?: string;
  cancelText?: string;
  hideCancel?: boolean;
  okTheme?: SessionButtonColor;
  closeTheme?: SessionButtonColor;
  sessionIcon?: SessionIconType;
  iconSize?: SessionIconSize;
  theme?: DefaultTheme;
  closeAfterClickOk?: boolean;
  shouldShowConfirm?: () => boolean | undefined;
}

const SessionConfirmInner = (props: SessionConfirmDialogProps) => {
  const {
    title = '',
    message = '',
    messageSub = '',
    okTheme = SessionButtonColor.Primary,
    closeTheme = SessionButtonColor.Primary,
    onClickOk,
    onClickClose,
    hideCancel = false,
    sessionIcon,
    iconSize,
    shouldShowConfirm,
  } = props;

  const okText = props.okText || window.i18n('ok');
  const cancelText = props.cancelText || window.i18n('cancel');
  const showHeader = !!props.title;

  const theme = useTheme();

  const messageSubText = messageSub ? 'session-confirm-main-message' : 'subtle';

  const onClickOkHandler = () => {
    if (onClickOk) {
      onClickOk();
    }

    window.inboxStore?.dispatch(updateConfirmModal(null));
  };

  if (shouldShowConfirm && !shouldShowConfirm()) {
    return null;
  }

  /**
   * Performs specified on close action then removes the modal.
   */
  const onClickCancelHandler = () => {
    if (onClickClose) {
      onClickClose();
    }

    window.inboxStore?.dispatch(updateConfirmModal(null));
  };

  return (
    <SessionWrapperModal
      title={title}
      onClose={onClickClose}
      showExitIcon={false}
      showHeader={showHeader}
    >
      {!showHeader && <SpacerLG />}

      <div className="session-modal__centered">
        {sessionIcon && iconSize && (
          <>
            <SessionIcon iconType={sessionIcon} iconSize={iconSize} theme={theme} />
            <SpacerLG />
          </>
        )}

        <SessionHtmlRenderer tag="span" className={messageSubText} html={message} />
        <SessionHtmlRenderer
          tag="span"
          className="session-confirm-sub-message subtle"
          html={messageSub}
        />
      </div>

      <div className="session-modal__button-group">
        <SessionButton text={okText} buttonColor={okTheme} onClick={onClickOkHandler} />

        {!hideCancel && (
          <SessionButton
            text={cancelText}
            buttonColor={closeTheme}
            onClick={onClickCancelHandler}
          />
        )}
      </div>
    </SessionWrapperModal>
  );
};

export const SessionConfirm = withTheme(SessionConfirmInner);
