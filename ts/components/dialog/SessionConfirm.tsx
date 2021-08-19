import React, { useState } from 'react';
import { SessionButton, SessionButtonColor } from '../session/SessionButton';
import { SessionHtmlRenderer } from '../session/SessionHTMLRenderer';
import { SessionIcon, SessionIconSize, SessionIconType } from '../session/icon';
import { DefaultTheme, useTheme, withTheme } from 'styled-components';
import { SessionWrapperModal } from '../session/SessionWrapperModal';
import { updateConfirmModal } from '../../state/ducks/modalDialog';
import { SpacerLG } from '../basic/Text';
import { SessionSpinner } from '../session/SessionSpinner';

export interface SessionConfirmDialogProps {
  message?: string;
  messageSub?: string;
  title?: string;
  onOk?: any;
  onClose?: any;
  onClickOk?: () => Promise<void> | void;
  onClickClose?: () => any;
  onClickCancel?: () => any;
  okText?: string;
  cancelText?: string;
  hideCancel?: boolean;
  okTheme?: SessionButtonColor;
  closeTheme?: SessionButtonColor;
  sessionIcon?: SessionIconType;
  iconSize?: SessionIconSize;
  theme?: DefaultTheme;
  shouldShowConfirm?: boolean | undefined;
  showExitIcon?: boolean | undefined;
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
    onClickCancel,
    showExitIcon,
  } = props;

  const [isLoading, setIsLoading] = useState(false);

  const okText = props.okText || window.i18n('ok');
  const cancelText = props.cancelText || window.i18n('cancel');
  const showHeader = !!props.title;

  const theme = useTheme();

  const messageSubText = messageSub ? 'session-confirm-main-message' : 'subtle';

  const onClickOkHandler = async () => {
    if (onClickOk) {
      setIsLoading(true);
      try {
        await onClickOk();
      } catch (e) {
        window.log.warn(e);
      } finally {
        setIsLoading(false);
      }
    }

    window.inboxStore?.dispatch(updateConfirmModal(null));
  };

  if (shouldShowConfirm && !shouldShowConfirm) {
    return null;
  }

  /**
   * Performs specified on close action then removes the modal.
   */
  const onClickCancelHandler = () => {
    if (onClickCancel) {
      onClickCancel();
    }

    if (onClickClose) {
      onClickClose();
    }

    window.inboxStore?.dispatch(updateConfirmModal(null));
  };

  return (
    <SessionWrapperModal
      title={title}
      onClose={onClickClose}
      showExitIcon={showExitIcon}
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

        <SessionSpinner loading={isLoading} />
      </div>

      <div className="session-modal__button-group">
        {!hideCancel && (
          <SessionButton
            text={cancelText}
            buttonColor={closeTheme}
            onClick={onClickCancelHandler}
          />
        )}
        <SessionButton text={okText} buttonColor={okTheme} onClick={onClickOkHandler} />
      </div>
    </SessionWrapperModal>
  );
};

export const SessionConfirm = withTheme(SessionConfirmInner);
