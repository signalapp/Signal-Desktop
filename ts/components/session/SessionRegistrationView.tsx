import React from 'react';
import { AccentText } from './AccentText';

import { RegistrationTabs } from './RegistrationTabs';

interface Props {
  showSubtitle: boolean;
}

export class SessionRegistrationView extends React.Component<Props> {
  constructor(props: Props) {
    super(props);
  }

  public render() {
    const { showSubtitle } = this.props;

    return (
      <div className="session-content">
        <div id="error" className="collapse" />
        <div className="session-content-accent">
          <AccentText showSubtitle={showSubtitle} />
        </div>
        <div className="session-content-registration">
          <RegistrationTabs />
        </div>
      </div>
    );
  }
}
