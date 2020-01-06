import React from 'react';
import { QRCode } from 'react-qr-svg';

import { SessionModal } from './SessionModal';
import { SessionButton } from './SessionButton';

interface Props {
  value: string;
  onClose: any;
}

export class SessionQRModal extends React.Component<Props> {
  constructor(props: any) {
    super(props);
  }

  public render() {
    const { value, onClose } = this.props;

    return (
      <SessionModal
        title={window.i18n('QRCodeTitle')}
        onOk={() => null}
        onClose={onClose}
      >
        <div className="spacer-sm" />

        <div className="qr-dialog__description text-subtle">
          <p>{window.i18n('QRCodeDescription')}</p>
        </div>
        <div className="spacer-lg" />

        <div id="qr">
          <QRCode value={value} bgColor="#FFFFFF" fgColor="#000000" level="L" />
        </div>

        <div className="spacer-lg" />
        <div className="session-modal__button-group">
          <SessionButton text={window.i18n('close')} onClick={onClose} />
        </div>
      </SessionModal>
    );
  }
}
