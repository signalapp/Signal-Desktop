import React from 'react';

export class MessageView extends React.Component {
  public render() {
    return (
      <div className="conversation placeholder">
        <div className="conversation-header" />
        <div className="container">
          <div className="content session-full-logo">
            <img
              src="images/session/brand.svg"
              className="session-brand-logo"
              alt="full-brand-logo"
            />
            <img
              src="images/session/session-text.svg"
              className="session-text-logo"
              alt="full-brand-logo"
            />
          </div>
        </div>
      </div>
    );
  }
}
