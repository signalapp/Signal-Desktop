import React from 'react';

import { SessionSpinner } from './session/SessionSpinner';

export class ConversationLoadingScreen extends React.PureComponent {
  constructor(props: any) {
    super(props);
  }

  public render() {
    return (
      <div className="conversation-loader">
        <SessionSpinner />
      </div>
    );
  }
}
