import React from 'react';
import { AccentText } from './AccentText';

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
}

export class SessionRegistrationView extends React.Component<Props> {
  constructor(props: Props) {
    super(props);
  }

  public render() {
    const { showSubtitle, i18n } = this.props;

    return (
      <div className="session-content">
        <div className="session-content-accent">
          <AccentText showSubtitle={showSubtitle || true} i18n={i18n} />
        </div>
        <div className="session-content-registration">
          <RegistrationTabs i18n={i18n} />
        </div>
      </div>
    );
  }
}
