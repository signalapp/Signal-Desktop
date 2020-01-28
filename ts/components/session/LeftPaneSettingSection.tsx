import React from 'react';
import classNames from 'classnames';

import { LeftPane } from '../LeftPane';

import { MainViewController } from '../MainViewController';

import {
  SessionButton,
  SessionButtonColor,
  SessionButtonType,
} from './SessionButton';

import { SessionIcon, SessionIconSize, SessionIconType } from './icon';
import { SessionSearchInput } from './SessionSearchInput';
import { SessionSettingCategory } from './settings/SessionSettings';

export interface State {
  settingCategory: SessionSettingCategory;
  searchQuery: string;
}

export class LeftPaneSettingSection extends React.Component<any, State> {
  public constructor(props: any) {
    super(props);

    this.state = {
      settingCategory: SessionSettingCategory.General,
      searchQuery: '',
    };

    this.setCategory = this.setCategory.bind(this);
  }

  public componentDidMount() {
    MainViewController.renderSettingsView(this.state.settingCategory);
  }

  public componentDidUpdate() {
    MainViewController.renderSettingsView(this.state.settingCategory);
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
      undefined
    );
  }

  public renderRow(item: any): JSX.Element {
    return (
      <div
        key={item.id}
        className={classNames(
          'left-pane-setting-category-list-item',
          item.id === this.state.settingCategory ? 'active' : ''
        )}
        role="link"
        onClick={() => {
          this.setCategory(item.id);
        }}
      >
        <div>
          <strong>{item.title}</strong>
          <br />
          <span className="text-subtle">{item.description}</span>
        </div>

        <div>
          {item.id === this.state.settingCategory && (
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

  public renderBottomButtons(): JSX.Element {
    const deleteAccount = window.i18n('deleteAccount');
    const showSeed = window.i18n('showSeed');

    return (
      <div className="left-pane-setting-bottom-buttons">
        <SessionButton
          text={deleteAccount}
          buttonType={SessionButtonType.SquareOutline}
          buttonColor={SessionButtonColor.Danger}
          onClick={this.onDeleteAccount}
        />
        <SessionButton
          text={showSeed}
          buttonType={SessionButtonType.SquareOutline}
          buttonColor={SessionButtonColor.White}
          onClick={window.showSeedDialog}
        />
      </div>
    );
  }

  public onDeleteAccount() {
    const params = {
      title: window.i18n('deleteAccount'),
      message: window.i18n('deleteAccountWarning'),
      messageSub: window.i18n('deleteAccountWarningSub'),
      resolve: window.deleteAccount,
      okTheme: 'danger',
    };

    window.confirmationDialog(params);
  }

  public getCategories() {
    return [
      {
        id: SessionSettingCategory.General,
        title: window.i18n('generalSettingsTitle'),
        description: window.i18n('generalSettingsDescription'),
        hidden: false,
      },
      {
        id: SessionSettingCategory.Privacy,
        title: window.i18n('privacySettingsTitle'),
        description: window.i18n('privacySettingsDescription'),
        hidden: false,
      },
      {
        id: SessionSettingCategory.Permissions,
        title: window.i18n('permissionSettingsTitle'),
        description: window.i18n('permissionSettingsDescription'),
        hidden: true,
      },
      {
        id: SessionSettingCategory.Notifications,
        title: window.i18n('notificationSettingsTitle'),
        description: window.i18n('notificationSettingsDescription'),
        hidden: false,
      },
      {
        id: SessionSettingCategory.Devices,
        title: window.i18n('devicesSettingsTitle'),
        description: window.i18n('devicesSettingsDescription'),
      },
    ];
  }

  public setCategory(category: SessionSettingCategory) {
    this.setState({
      settingCategory: category,
    });
  }

  // public updateSearch(searchTerm: string) {
  //   const { updateSearchTerm, clearSearch } = this.props;

  //   if (!searchTerm) {
  //     clearSearch();

  //     return;
  //   }
  //   // reset our pubKeyPasted, we can either have a pasted sessionID or a sessionID got from a search
  //   this.setState({ pubKeyPasted: '' }, () => {
  //     window.Session.emptyContentEditableDivs();
  //   });

  //   if (updateSearchTerm) {
  //     updateSearchTerm(searchTerm);
  //   }

  //   if (searchTerm.length < 2) {
  //     return;
  //   }

  //   const cleanedTerm = cleanSearchTerm(searchTerm);
  //   if (!cleanedTerm) {
  //     return;
  //   }

  //   this.debouncedSearch(cleanedTerm);
  // }
}
