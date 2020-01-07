import React from 'react';
import classNames from 'classnames';

import { LeftPane } from '../LeftPane';

import {
  SessionButton,
  SessionButtonColor,
  SessionButtonType,
} from './SessionButton';

import {
  SessionIcon,
  SessionIconSize,
  SessionIconType,
} from './icon';


export enum SessionSettingCategory {
  Privacy = 'privacy',
  Notifications = 'notifications',
  Devices = 'devices',
}

export interface Props {
  
}

export interface State {
  settingCategory: SessionSettingCategory;
}

export class LeftPaneSettingSection extends React.Component<Props, State> {
  
  public constructor(props: Props) {
    super(props);

    this.state = {
      settingCategory: SessionSettingCategory.Privacy,
    };

    this.setCategory = this.setCategory.bind(this);
    this.renderRows = this.renderRows.bind(this);

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
    );
  }

  public renderRows () {

    const categories = this.getCategories();

    return (
      <>
        {categories.map((item) => (
            <div
              key={item.id}
              className={classNames('left-pane-setting-category-list-item', item.id === this.state.settingCategory ? 'active' : '')}
              onClick={() => this.setCategory(item.id)}
            >
              <div>
                <strong>{ item.title }</strong>
                <br/>
                <span className="text-subtle">
                  {item.description }
                </span>
              </div>

              <div>
                { item.id === this.state.settingCategory &&
                  <SessionIcon
                    iconSize={SessionIconSize.Medium}
                    iconType={SessionIconType.Chevron}
                    iconRotation={270}
                  />
                }
              </div>
            </div>
          ))}

      </>
    );
  }

  public renderCategories() {

    return (
      <div className="module-left-pane__list" key={0}>
          <div className="left-pane-setting-category-list">
            {this.renderRows()}
          </div>
      </div>
    )
  }

  public renderSettings(): JSX.Element {
    return (
      <div className="left-pane-setting-content">
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
        />
        <SessionButton
          text={showSeed}
          buttonType={SessionButtonType.SquareOutline}
          buttonColor={SessionButtonColor.White}
        />
      </div>
    );
  }

  public getCategories(){
    return [
      {
        id: SessionSettingCategory.Privacy,
        title: 'Privacy',
        description: 'Privacy description',
      },
      {
        id: SessionSettingCategory.Notifications,
        title: 'Notifications',
        description: "Choose what you're notified about."
      },
      {
        id: SessionSettingCategory.Devices,
        title: 'Linked Devices',
        description: "Managed linked devices."
      }
    ];
  }

  public setCategory(category: SessionSettingCategory) {
    this.setState({
      settingCategory: category,
    });
  }
}
