import React from 'react';
import { AccentText } from './AccentText';
//import classNames from 'classnames';

import { LocalizerType } from '../../types/Util';
import { RegistrationTabs } from './RegistrationTabs';

declare global {
  interface Window {
    displayNameRegex: any;
  }
}

interface Props {
  showSubtitle: boolean;
  i18n: LocalizerType;
  /* profileName: string;
  avatarPath: string;
  avatarColor: string;
  pubkey: string;
  onClose: any;
  onStartConversation: any; */
}
/*
interface State {
  avatarColor: string;
} */

export class SessionRegistrationView extends React.Component<Props> {
  constructor(props: Props) {
    super(props);

    //this.closeDialog = this.closeDialog.bind(this);
    window.addEventListener('keyup', this.onKeyUp);
  }

  public render() {
    //const i18n = this.props.i18n;
    //const cancelText = i18n('cancel');

    const { showSubtitle, i18n } = this.props;

    return (
      <div className="session-content">
        <div className="session-content-accent">
          <AccentText showSubtitle={showSubtitle || true} />
        </div>
        <div className="session-content-registration">
          <RegistrationTabs i18n={i18n} />
        </div>
      </div>
    );
  }

  private onKeyUp(event: any) {
    switch (event.key) {
      case 'Enter':
        break;
      case 'Esc':
      case 'Escape':
        break;
      default:
    }
  }
}
