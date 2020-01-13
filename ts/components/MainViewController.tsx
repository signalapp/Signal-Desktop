import React from 'react';
import ReactDOM from 'react-dom';

import {
  SessionSettingListItem,
  SessionSettingType,
} from './session/settings/SessionSettingListItem';

import { SessionSettingCategory } from './session/LeftPaneSettingSection';
import { SessionButtonColor } from './session/SessionButton';
import { SessionIconButton, SessionIconType, SessionIconSize } from './session/icon';

// Grab initial values from database on startup
const localSettings = [
  {
    id: 'typingIndicators',
    title: 'Typing Indicators',
    description:
      'See and share when messages are being typed. This setting is optional and applies to all conversations.',
    type: SessionSettingType.Toggle,
    category: SessionSettingCategory.Privacy,
    value: false,
  },
  {
    id: 'screenLock',
    title: 'Screen Lock',
    description:
      'Unlock Loki Session using your password. Visit notification settings to customise.',
    type: SessionSettingType.Toggle,
    category: SessionSettingCategory.Privacy,
    value: true,
  },
  {
    id: 'screenSecurity',
    title: 'Screen Security',
    description:
      'Prevent Loki Session previews from appearing in desktop notifications.',
    type: SessionSettingType.Toggle,
    category: SessionSettingCategory.Privacy,
    value: false,
  },
  {
    id: 'linkPreviews',
    title: 'Send Link Previews',
    description:
      'Supported for Imgur, Instagram, Pinterest, Reddit and YouTube.',
    type: SessionSettingType.Toggle,
    category: SessionSettingCategory.Privacy,
    value: true,
  },
  {
    id: 'clearConversationHistory',
    title: 'Clear Conversation History',
    category: SessionSettingCategory.Privacy,
    type: SessionSettingType.Button,
    value: false,
    buttonText: 'Clear',
    buttonColor: SessionButtonColor.Danger,
  },
  {
    id: 'changePassword',
    title: 'Change Password',
    category: SessionSettingCategory.Account,
    type: SessionSettingType.Button,
    value: false,
    buttonText: 'Change',
    buttonColor: SessionButtonColor.Primary,
  },
  {
    id: 'removePassword',
    title: 'Remove Password',
    category: SessionSettingCategory.Account,
    type: SessionSettingType.Button,
    value: false,
    buttonText: 'Remove',
    buttonColor: SessionButtonColor.Danger,
  },
];

export class MainViewController {

  public static renderMessageView() {
    ReactDOM.render(
      <MessageView/>,
      document.getElementById('main-view')
    );
  }

  public static renderSettingsView(category: SessionSettingCategory) {
    ReactDOM.render(
        <SettingsView category={category}/>,
      document.getElementById('main-view')
    );
  }
}


interface SettingsViewProps {
  category: SessionSettingCategory
}

export class SettingsView extends React.Component<SettingsViewProps>{
  public settingsViewRef: React.RefObject<HTMLDivElement>;

  public constructor(props: any) {
    super(props);
    this.settingsViewRef = React.createRef();
  }

  render() {
    const { category } = this.props;

    return (
      <div className="session-settings">
        <SettingsHeader category={category}/>
        <div
          ref = {this.settingsViewRef}
          className="session-settings-list"
        >
          
          
          {localSettings.map(setting => {
            return (
              <div key={setting.id}>
                {setting.category === category && (
                  <SessionSettingListItem
                    title={setting.title}
                    description={setting.description}
                    type={setting.type}
                    value={setting.value}
                    onClick={() => {
                      SettingsManager.updateSetting(setting);
                    }}
                    buttonText={setting.buttonText || undefined}
                    buttonColor={setting.buttonColor || undefined}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    )
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
              />
              <p className="session-logo-text">SESSION</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export class SettingsHeader extends React.Component<SettingsViewProps>{
  public constructor(props: any) {
    super(props);
  }

  public focusSearch(){
    $('.left-pane-setting-section .session-search-input input').focus();
  }

  render() {
    const category = String(this.props.category)
    const categoryTitlePrefix = category[0].toUpperCase() + category.substr(1);
    // Remove 's' on the end to keep words in singular form
    const categoryTitle = categoryTitlePrefix[categoryTitlePrefix.length - 1] === 's'
      ? categoryTitlePrefix.slice(0, -1) + ' Settings'
      : categoryTitlePrefix + ' Settings';

    return (
      <div className="session-settings-header">
        { categoryTitle } 
        <SessionIconButton
          iconType={SessionIconType.Search}
          iconSize={SessionIconSize.Large}
          onClick={this.focusSearch}
        />
      </div>
    );
  }
}


export class SettingsManager {
  public static updateSetting({ id, type, value }) {
    if (type === SessionSettingType.Toggle) {
      alert(`You clicked a toggle with ID: ${id}`);

      // Manage toggle events

      return;
    }

    alert('you clicked something else');

    return;
  }
}
