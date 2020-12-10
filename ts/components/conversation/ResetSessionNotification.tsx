import React from 'react';

interface Props {
  sessionResetMessageKey: string;
}

export class ResetSessionNotification extends React.Component<Props> {
  public render() {
    const { sessionResetMessageKey } = this.props;

    return (
      <div className="module-reset-session-notification">
        {window.i18n(sessionResetMessageKey)}
      </div>
    );
  }
}
