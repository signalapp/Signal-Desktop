import React from 'react';

import { LocalizerType } from '../../types/Util';

interface Props {
  i18n: LocalizerType;
  sessionResetMessageKey: string;
}

export class ResetSessionNotification extends React.Component<Props> {
  public render() {
    const { i18n, sessionResetMessageKey } = this.props;

    return (
      <div className="module-reset-session-notification">
        {i18n(sessionResetMessageKey)}
      </div>
    );
  }
}
