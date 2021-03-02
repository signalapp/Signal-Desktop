import React from 'react';
import classNames from 'classnames';

import { LeftPane } from '../LeftPane';

import {
  SessionButton,
  SessionButtonColor,
  SessionButtonType,
} from './SessionButton';

import { SessionIcon, SessionIconSize, SessionIconType } from './icon';
import { SessionSearchInput } from './SessionSearchInput';
import { SessionSettingCategory } from './settings/SessionSettings';
import { DefaultTheme } from 'styled-components';
import { LeftPaneSectionHeader } from './LeftPaneSectionHeader';
import { AccountManager } from '../../util';

interface Props {
  settingsCategory: SessionSettingCategory;
  showSessionSettingsCategory: (category: SessionSettingCategory) => void;
  theme: DefaultTheme;
}

export interface State {
  searchQuery: string;
}

export class LeftPaneSettingSection extends React.Component<Props, State> {
  public constructor(props: any) {
    super(props);

    this.state = {
      searchQuery: '',
    };

    this.setCategory = this.setCategory.bind(this);
    this.onDeleteAccount = this.onDeleteAccount.bind(this);
  }

  public render(): JSX.Element {
    return (
      <div className="left-pane-setting-section">
        {this.renderHeader()}
        {this.renderSettings()}
      </div>
    );
  }

  public renderHeader(): JSX.Element | undefined {
    return (
      <LeftPaneSectionHeader
        label={window.i18n('settingsHeader')}
        theme={this.props.theme}
      />
    );
  }

  public renderRow(item: any): JSX.Element {
    const { settingsCategory } = this.props;
    return (
      <div
        key={item.id}
        className={classNames(
          'left-pane-setting-category-list-item',
          item.id === settingsCategory ? 'active' : ''
        )}
        role="link"
        onClick={() => {
          this.setCategory(item.id);
        }}
      >
        <div>
          <strong>{item.title}</strong>
        </div>

        <div>
          {item.id === settingsCategory && (
            <SessionIcon
              iconSize={SessionIconSize.Medium}
              iconType={SessionIconType.Chevron}
              iconRotation={270}
              theme={this.props.theme}
            />
          )}
        </div>
      </div>
    );
  }

  public renderCategories(): JSX.Element {
    const categories = this.getCategories().filter(item => !item.hidden);

    return (
      <div className="module-left-pane__list" key={0}>
        <div className="left-pane-setting-category-list">
          {categories.map(item => this.renderRow(item))}
        </div>
      </div>
    );
  }

  public renderSearch() {
    return (
      <div className="left-pane-setting-content">
        <div className="left-pane-setting-input-group">
          <SessionSearchInput
            searchString={this.state.searchQuery}
            onChange={() => null}
            placeholder=""
            theme={this.props.theme}
          />
          <div className="left-pane-setting-input-button">
            <SessionButton
              buttonType={SessionButtonType.Square}
              buttonColor={SessionButtonColor.Green}
              theme={this.props.theme}
            >
              <SessionIcon
                iconType={SessionIconType.Caret}
                iconSize={SessionIconSize.Huge}
                theme={this.props.theme}
              />
            </SessionButton>
          </div>
        </div>
      </div>
    );
  }

  public renderSettings(): JSX.Element {
    const showSearch = false;

    return (
      <div className="left-pane-setting-content">
        {showSearch && this.renderSearch()}
        {this.renderCategories()}
        {this.renderBottomButtons()}
      </div>
    );
  }

  public renderBottomButtons(): JSX.Element | undefined {
    const dangerButtonText = window.i18n('clearAllData');
    const showRecoveryPhrase = window.i18n('showRecoveryPhrase');

    return (
      <div className="left-pane-setting-bottom-buttons">
        <SessionButton
          text={dangerButtonText}
          buttonType={SessionButtonType.SquareOutline}
          buttonColor={SessionButtonColor.Danger}
          onClick={this.onDeleteAccount}
        />

        <SessionButton
          text={showRecoveryPhrase}
          buttonType={SessionButtonType.SquareOutline}
          buttonColor={SessionButtonColor.White}
          onClick={() => window.Whisper.events.trigger('showSeedDialog')}
        />
      </div>
    );
  }

  public onDeleteAccount() {
    const title = window.i18n('clearAllData');

    const message = window.i18n('unpairDeviceWarning');

    let messageSub = '';

    const identityKey = window.textsecure.storage.get('identityKey');
    if (identityKey && identityKey.ed25519KeyPair === undefined) {
      messageSub =
        "We've updated the way Session IDs are generated, so you will not be able to restore your current Session ID.";
    }

    window.confirmationDialog({
      title,
      message,
      messageSub,
      resolve: AccountManager.deleteAccount,
      okTheme: 'danger',
    });
  }

  public getCategories() {
    return [
      {
        id: SessionSettingCategory.Appearance,
        title: window.i18n('appearanceSettingsTitle'),
        hidden: false,
      },
      {
        id: SessionSettingCategory.Privacy,
        title: window.i18n('privacySettingsTitle'),
        hidden: false,
      },
      {
        id: SessionSettingCategory.Blocked,
        title: window.i18n('blockedSettingsTitle'),
        hidden: false,
      },
      {
        id: SessionSettingCategory.Permissions,
        title: window.i18n('permissionSettingsTitle'),
        hidden: true,
      },
      {
        id: SessionSettingCategory.Notifications,
        title: window.i18n('notificationsSettingsTitle'),
        hidden: false,
      },
    ];
  }

  public setCategory(category: SessionSettingCategory) {
    this.props.showSessionSettingsCategory(category);
  }
}
