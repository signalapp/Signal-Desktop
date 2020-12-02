import React from 'react';
import { SessionModal } from './SessionModal';
import { SessionButton, SessionButtonColor } from './SessionButton';
import { SessionHtmlRenderer } from './SessionHTMLRenderer';
import { SessionIcon, SessionIconSize, SessionIconType } from './icon';

interface Props {
  message: string;
  messageSub: string;
  title: string;
  onOk?: any;
  onClose?: any;
  onClickOk: any;
  onClickClose: any;
  okText?: string;
  cancelText?: string;
  hideCancel: boolean;
  okTheme: SessionButtonColor;
  closeTheme: SessionButtonColor;
  sessionIcon?: SessionIconType;
  iconSize?: SessionIconSize;
}

export class SessionConfirm extends React.Component<Props> {
  public static defaultProps = {
    title: '',
    messageSub: '',
    okTheme: SessionButtonColor.Primary,
    closeTheme: SessionButtonColor.Primary,
    hideCancel: false,
  };

  constructor(props: any) {
    super(props);
  }

  public render() {
    const {
      title,
      message,
      messageSub,
      okTheme,
      closeTheme,
      onClickOk,
      onClickClose,
      hideCancel,
      sessionIcon,
      iconSize,
    } = this.props;

    const okText = this.props.okText || window.i18n('ok');
    const cancelText = this.props.cancelText || window.i18n('cancel');
    const showHeader = !!this.props.title;

    const messageSubText = messageSub
      ? 'session-confirm-main-message'
      : 'subtle';

    return (
      <SessionModal
        title={title}
        onClose={onClickClose}
        onOk={() => null}
        showExitIcon={false}
        showHeader={showHeader}
      >
        {!showHeader && <div className="spacer-lg" />}

        <div className="session-modal__centered">
          {sessionIcon && iconSize && (
            <div>
              <SessionIcon iconType={sessionIcon} iconSize={iconSize} />
              <div className="spacer-lg" />
            </div>
          )}

          <SessionHtmlRenderer
            tag="span"
            className={messageSubText}
            html={message}
          />
          <SessionHtmlRenderer
            tag="span"
            className="session-confirm-sub-message subtle"
            html={messageSub}
          />
        </div>

        <div className="session-modal__button-group">
          <SessionButton
            text={okText}
            buttonColor={okTheme}
            onClick={onClickOk}
          />

          {!hideCancel && (
            <SessionButton
              text={cancelText}
              buttonColor={closeTheme}
              onClick={onClickClose}
            />
          )}
        </div>
      </SessionModal>
    );
  }
}
