import React from 'react';

import { Localizer } from '../../types/Util';

interface Props {
  i18n: Localizer;
  sessionResetMessageKey: string;
}

export class ResetSessionNotification extends React.Component<Props> {
  public render() {
    const { i18n, sessionResetMessageKey } = this.props;

    return (
      <div className="module-reset-session-notification">
        { i18n(sessionResetMessageKey) }
      </div>
    );
  }
}
