import React from 'react';
import { SessionModal } from './SessionModal';
import { SessionButton, SessionButtonColor } from './SessionButton';
import { SessionHtmlRenderer } from './SessionHTMLRenderer';
import { SessionIcon, SessionIconSize, SessionIconType } from './icon';
import { DefaultTheme, useTheme, withTheme } from 'styled-components';
import { SessionWrapperModal } from './SessionWrapperModal';

type Props = {
  message: string;
  messageSub?: string;
  title: string;
  onOk?: any;
  onClose?: any;
  onClickOk: any;
  onClickClose?: any;
  okText?: string;
  cancelText?: string;
  hideCancel?: boolean;
  okTheme: SessionButtonColor;
  closeTheme?: SessionButtonColor;
  sessionIcon?: SessionIconType;
  iconSize?: SessionIconSize;
  theme?: DefaultTheme;
};

const SessionConfirmInner = (props: Props) => {
  const {
    title = '',
    message,
    messageSub = '',
    okTheme = SessionButtonColor.Primary,
    closeTheme = SessionButtonColor.Primary,
    onClickOk,
    onClickClose,
    hideCancel = false,
    sessionIcon,
    iconSize,
  } = props;

  const okText = props.okText || window.i18n('ok');
  const cancelText = props.cancelText || window.i18n('cancel');
  const showHeader = !!props.title;

  const theme = useTheme();

  const messageSubText = messageSub ? 'session-confirm-main-message' : 'subtle';


  // <SessionModal
  //   title={title}
  //   onClose={onClickClose}
  //   showExitIcon={false}
  //   showHeader={showHeader}
  //   theme={theme}
  // >

  return (

    <SessionWrapperModal
      title={title}
      onClose={onClickClose}
      showExitIcon={false}
      showHeader={showHeader}
      theme={theme}
    >

      {!showHeader && <div className="spacer-lg" />}

      <div className="session-modal__centered">
        {sessionIcon && iconSize && (
          <>
            <SessionIcon iconType={sessionIcon} iconSize={iconSize} theme={theme} />
            <div className="spacer-lg" />
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
        <SessionButton text={okText} buttonColor={okTheme} onClick={onClickOk} />

        {!hideCancel && (
          <SessionButton text={cancelText} buttonColor={closeTheme} onClick={onClickClose} />
        )}
      </div>
      {/* </SessionModal> */}
    </SessionWrapperModal>
  );
};

export const SessionConfirm = withTheme(SessionConfirmInner);
