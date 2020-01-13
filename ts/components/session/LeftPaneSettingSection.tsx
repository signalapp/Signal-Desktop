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

export enum SessionSettingCategory {
  General = 'general',
  Account = 'account',
  Privacy = 'privacy',
  Notifications = 'notifications',
  Devices = 'devices',
}

export interface Props {}

export interface State {
  settingCategory: SessionSettingCategory;
  searchQuery: string;
}

export class LeftPaneSettingSection extends React.Component<Props, State> {
  public constructor(props: Props) {
    super(props);

    this.state = {
      settingCategory: SessionSettingCategory.General,
      searchQuery: '',
    };

    this.setCategory = this.setCategory.bind(this);
    this.renderRows = this.renderRows.bind(this);

    //this.updateSearchBound = this.updateSearch.bind(this);
  }

  public render(): JSX.Element {
    MainViewController.renderSettingsView(this.state.settingCategory);

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

  public renderRows(): JSX.Element {
    const categories = this.getCategories();

    return (
      <>
        {categories.map(item => (
          <div
            key={item.id}
            className={classNames(
              'left-pane-setting-category-list-item',
              item.id === this.state.settingCategory ? 'active' : ''
            )}
            onClick={() => this.setCategory(item.id)}
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
        ))}
      </>
    );
  }

  public renderCategories(): JSX.Element {
    return (
      <div className="module-left-pane__list" key={0}>
        <div className="left-pane-setting-category-list">
          {this.renderRows()}
        </div>
      </div>
    );
  }

  public renderSettings(): JSX.Element {
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
                iconSize={SessionIconSize.Large}
              />
            </SessionButton>
          </div>
        </div>
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
      },
      {
        id: SessionSettingCategory.Account,
        title: window.i18n('accountSettingsTitle'),
        description: window.i18n('accountSettingsDescription'),
      },
      {
        id: SessionSettingCategory.Privacy,
        title: window.i18n('privacySettingsTitle'),
        description: window.i18n('privacySettingsDescription'),
      },
      {
        id: SessionSettingCategory.Notifications,
        title: window.i18n('notificationSettingsTitle'),
        description: window.i18n('notificationSettingsDescription'),
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
