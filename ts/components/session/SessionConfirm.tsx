import React from 'react';
import { SessionModal } from './SessionModal';
import { SessionButton } from './SessionButton';

interface Props {
  message: string;
  title: string;
  onOk?: any;
  onClose?: any;
  onClickOk: any;
  onClickClose: any;
  okText?: string;
  cancelText?: string;
  hideCancel: boolean;
}

export class SessionConfirm extends React.Component<Props> {
  public static defaultProps = {
    title: '',
    hideCancel: false,
  };

  constructor(props: any) {
    super(props);
  }

  public render() {
    const { title, message, onClickOk, onClickClose, hideCancel } = this.props;

    const okText = this.props.okText || window.i18n('ok');
    const cancelText = this.props.cancelText || window.i18n('cancel');
    const showHeader = !!this.props.title;

    return (
      <SessionModal
        title={title}
        onClose={() => null}
        onOk={() => null}
        showExitIcon={false}
        showHeader={showHeader}
      >
        {!showHeader && <div className="spacer-lg" />}

        <div className="session-modal__centered">
          <span className="text-subtle">{message}</span>
        </div>

        <div className="spacer-lg" />

        <div className="session-modal__button-group">
          <SessionButton text={okText} onClick={onClickOk} />

          {!hideCancel && (
            <SessionButton text={cancelText} onClick={onClickClose} />
          )}
        </div>
      </SessionModal>
    );
  }
}
