import React from 'react';
import { QRCode } from 'react-qr-svg';

import { SessionModal } from './SessionModal';

interface Props {
  value: string;
}

export class SessionQRModal extends React.Component<Props> {
  constructor(props: any) {
    super(props);
  }

  public render() {
    const { value } = this.props;

    console.log('skbsvbsgb');
    console.log('skbsvbsgb');
    console.log('skbsvbsgb');

    return (
      <SessionModal
        title={window.i18n('QRCodeTitle')}
        onOk={() => null}
        onClose={() => null}
      >
        <div className="spacer-sm"></div>
        
        <div className='qr-dialog__description text-subtle'>
            <p>
                {window.i18n('QRCodeDescription')}
            </p>
        </div>
        <div className="spacer-lg"></div>

        <div id="qr">
            <QRCode
                value={value}
                bgColor="#FFFFFF"
                fgColor="#000000"
                level="L"
            />
        </div>
        
      </SessionModal>
      );
    }
  }