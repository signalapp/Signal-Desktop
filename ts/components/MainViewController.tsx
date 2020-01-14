import React from 'react';
import ReactDOM from 'react-dom';

import {
  SessionSettingCategory,
  SettingsView,
} from './session/settings/SessionSettings';

export class MainViewController {
  constructor() {}

  static renderMessageView() {
    ReactDOM.render(<MessageView />, document.getElementById('main-view'));
  }

  static renderSettingsView(category: SessionSettingCategory) {
    ReactDOM.render(
      <SettingsView category={category} />,
      document.getElementById('main-view')
    );
  }
}

export class MessageView extends React.Component {
  render() {
    return (
      <div className="conversation-stack">
        <div className="conversation placeholder">
          <div className="conversation-header" />
          <div className="container">
            <div className="content">
              <img
                src="images/session/brand.svg"
                className="session-filter-color-green session-logo-128"
                alt="Brand"
              />
              <p className="session-logo-text">SESSION</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
