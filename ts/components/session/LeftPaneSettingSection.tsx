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

interface Props {
  isSecondaryDevice: boolean;
  settingsCategory: SessionSettingCategory;
  showSessionSettingsCategory: (category: SessionSettingCategory) => void;
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
    const labels = [window.i18n('settingsHeader')];

    return LeftPane.RENDER_HEADER(
      labels,
      null,
      undefined,
      undefined,
      undefined,
      undefined
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
          />
          <div className="left-pane-setting-input-button">
            <SessionButton
              buttonType={SessionButtonType.Square}
              buttonColor={SessionButtonColor.Green}
            >
              <SessionIcon
                iconType={SessionIconType.Caret}
                iconSize={SessionIconSize.Huge}
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
    const { isSecondaryDevice } = this.props;

    const dangerButtonText = isSecondaryDevice
      ? window.i18n('unpairDevice')
      : window.i18n('clearAllData');
    const showRecoveryPhrase = window.i18n('showRecoveryPhrase');

    return (
      <div className="left-pane-setting-bottom-buttons">
        <SessionButton
          text={dangerButtonText}
          buttonType={SessionButtonType.SquareOutline}
          buttonColor={SessionButtonColor.Danger}
          onClick={this.onDeleteAccount}
        />
        {!isSecondaryDevice && (
          <SessionButton
            text={showRecoveryPhrase}
            buttonType={SessionButtonType.SquareOutline}
            buttonColor={SessionButtonColor.White}
            onClick={window.showSeedDialog}
          />
        )}
      </div>
    );
  }

  public onDeleteAccount() {
    const { isSecondaryDevice } = this.props;

    const title = window.i18n(
      isSecondaryDevice ? 'unpairDevice' : 'clearAllData'
    );

    const message = window.i18n(
      isSecondaryDevice ? 'unpairDeviceWarning' : 'deleteAccountWarning'
    );

    const messageSub = isSecondaryDevice
      ? window.i18n('unpairDeviceWarningSub')
      : '';

    window.confirmationDialog({
      title,
      message,
      messageSub,
      resolve: window.deleteAccount,
      okTheme: 'danger',
    });
  }

  public getCategories() {
    const { isSecondaryDevice } = this.props;

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
      {
        id: SessionSettingCategory.Devices,
        title: window.i18n('devicesSettingsTitle'),
        hidden: !window.lokiFeatureFlags.useMultiDevice || isSecondaryDevice,
      },
    ];
  }

  public setCategory(category: SessionSettingCategory) {
    this.props.showSessionSettingsCategory(category);
  }
}
