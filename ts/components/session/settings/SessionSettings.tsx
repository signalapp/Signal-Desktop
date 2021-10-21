import React from 'react';

import { SettingsHeader } from './SessionSettingsHeader';
import { SessionSettingListItem } from './SessionSettingListItem';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../SessionButton';
import { PasswordUtil } from '../../../util';
import { ConversationLookupType } from '../../../state/ducks/conversations';
import { StateType } from '../../../state/reducer';
import { getConversationLookup } from '../../../state/selectors/conversations';
import { connect } from 'react-redux';
import { getPasswordHash } from '../../../../ts/data/data';
import { shell } from 'electron';
import { mapDispatchToProps } from '../../../state/actions';
import { SessionIconButton } from '../icon';
import autoBind from 'auto-bind';
import {
  getLocalSettings,
  LocalSettingType,
  SessionSettingCategory,
  SessionSettingType,
} from './LocalSettings';
import { getBlockedUserSettings } from './BlockedUserSettings';

export function getMediaPermissionsSettings() {
  return window.getSettingValue('media-permissions');
}

export function getCallMediaPermissionsSettings() {
  return window.getSettingValue('call-media-permissions');
}

export interface SettingsViewProps {
  category: SessionSettingCategory;
  // pass the conversation as props, so our render is called everytime they change.
  // we have to do this to make the list refresh on unblock()
  conversations?: ConversationLookupType;
}

interface State {
  hasPassword: boolean | null;
  pwdLockError: string | null;
  mediaSetting: boolean | null;
  callMediaSetting: boolean | null;
  shouldLockSettings: boolean | null;
}

export const PasswordLock = ({
  pwdLockError,
  validatePasswordLock,
}: {
  pwdLockError: string | null;
  validatePasswordLock: () => Promise<boolean>;
}) => {
  return (
    <div className="session-settings__password-lock">
      <div className="session-settings__password-lock-box">
        <h3>{window.i18n('password')}</h3>
        <input type="password" id="password-lock-input" defaultValue="" placeholder="Password" />

        {pwdLockError && <div className="session-label warning">{pwdLockError}</div>}

        <SessionButton
          buttonType={SessionButtonType.BrandOutline}
          buttonColor={SessionButtonColor.Green}
          text={window.i18n('ok')}
          onClick={validatePasswordLock}
        />
      </div>
    </div>
  );
};

const SessionInfo = () => {
  const openOxenWebsite = () => {
    void shell.openExternal('https://oxen.io/');
  };
  return (
    <div className="session-settings__version-info">
      <span className="text-selectable">v{window.versionInfo.version}</span>
      <span>
        <SessionIconButton iconSize={'medium'} iconType="oxen" onClick={openOxenWebsite} />
      </span>
      <span className="text-selectable">{window.versionInfo.commitHash}</span>
    </div>
  );
};

class SettingsViewInner extends React.Component<SettingsViewProps, State> {
  public settingsViewRef: React.RefObject<HTMLDivElement>;

  public constructor(props: any) {
    super(props);

    this.state = {
      hasPassword: null,
      pwdLockError: null,
      mediaSetting: null,
      callMediaSetting: null,
      shouldLockSettings: true,
    };

    this.settingsViewRef = React.createRef();
    autoBind(this);

    void this.hasPassword();
  }

  public componentDidMount() {
    window.addEventListener('keyup', this.onKeyUp);

    const mediaSetting = getMediaPermissionsSettings();
    const callMediaSetting = getCallMediaPermissionsSettings();
    this.setState({ mediaSetting, callMediaSetting });

    setTimeout(() => ($('#password-lock-input') as any).focus(), 100);
  }

  public componentWillUnmount() {
    window.removeEventListener('keyup', this.onKeyUp);
  }

  /* tslint:disable-next-line:max-func-body-length */
  public renderSettingInCategory() {
    const { category } = this.props;

    let settings: Array<LocalSettingType>;

    if (category === SessionSettingCategory.Blocked) {
      // special case for blocked user
      settings = getBlockedUserSettings();
    } else {
      // Grab initial values from database on startup
      // ID corresponds to installGetter parameters in preload.js
      // They are NOT arbitrary; add with caution

      settings = getLocalSettings(this.state.hasPassword, this.onPasswordUpdated, this.forceUpdate);
    }

    return (
      <>
        {this.state.hasPassword !== null &&
          settings.map(setting => {
            const content = setting.content || undefined;
            const shouldRenderSettings = setting.category === category;
            const description = setting.description || '';

            const comparisonValue = setting.comparisonValue || null;
            const storedSetting = window.getSettingValue(setting.id, comparisonValue);
            const value =
              storedSetting !== undefined
                ? storedSetting
                : setting.content && setting.content.defaultValue;

            if (setting.id.startsWith('call-media')) console.warn('storedSetting call: ', value);

            const sliderFn =
              setting.type === SessionSettingType.Slider
                ? (settingValue: any) => window.setSettingValue(setting.id, settingValue)
                : () => null;

            const onClickFn =
              setting.onClick ||
              ((settingValue?: string) => {
                this.updateSetting(setting, settingValue);
              });

            return (
              <div key={setting.id}>
                {shouldRenderSettings && !setting.hidden && (
                  <SessionSettingListItem
                    title={setting.title}
                    description={description}
                    type={setting.type}
                    value={value}
                    onClick={onClickFn}
                    onSliderChange={sliderFn}
                    content={content}
                  />
                )}
              </div>
            );
          })}
      </>
    );
  }

  public async validatePasswordLock() {
    const enteredPassword = String(jQuery('#password-lock-input').val());

    if (!enteredPassword) {
      this.setState({
        pwdLockError: window.i18n('noGivenPassword'),
      });

      return false;
    }

    // Check if the password matches the hash we have stored
    const hash = await getPasswordHash();
    if (hash && !PasswordUtil.matchesHash(enteredPassword, hash)) {
      this.setState({
        pwdLockError: window.i18n('invalidPassword'),
      });

      return false;
    }

    // Unlocked settings
    this.setState({
      shouldLockSettings: false,
      pwdLockError: null,
    });

    return true;
  }

  public render() {
    const { category } = this.props;
    const shouldRenderPasswordLock = this.state.shouldLockSettings && this.state.hasPassword;

    return (
      <div className="session-settings">
        <SettingsHeader
          category={category}
          categoryTitle={window.i18n(`${category}SettingsTitle`)}
        />

        <div className="session-settings-view">
          {shouldRenderPasswordLock ? (
            <PasswordLock
              pwdLockError={this.state.pwdLockError}
              validatePasswordLock={this.validatePasswordLock}
            />
          ) : (
            <div ref={this.settingsViewRef} className="session-settings-list">
              {this.renderSettingInCategory()}
            </div>
          )}
          <SessionInfo />
        </div>
      </div>
    );
  }

  public async hasPassword() {
    const hash = await getPasswordHash();

    this.setState({
      hasPassword: !!hash,
    });
  }

  /**
   * If there's a custom afterClick function, execute it instead of automatically updating settings
   * @param item setting item
   * @param value new value to set
   */
  public updateSetting(item: any, value?: string) {
    if (item.setFn) {
      item.setFn(value);
      this.forceUpdate();
    } else if (item.type === SessionSettingType.Toggle) {
      // If no custom afterClick function given, alter values in storage here

      // Switch to opposite state
      const newValue = !window.getSettingValue(item.id);
      window.setSettingValue(item.id, newValue);
      this.forceUpdate();
    }
  }

  public onPasswordUpdated(action: string) {
    if (action === 'set' || action === 'change') {
      this.setState({
        hasPassword: true,
        shouldLockSettings: true,
        pwdLockError: null,
      });
    }

    if (action === 'remove') {
      this.setState({
        hasPassword: false,
      });
    }
  }

  private async onKeyUp(event: any) {
    const lockPasswordFocussed = ($('#password-lock-input') as any).is(':focus');

    if (event.key === 'Enter' && lockPasswordFocussed) {
      await this.validatePasswordLock();
    }

    event.preventDefault();
  }
}

const mapStateToProps = (state: StateType) => {
  return {
    conversations: getConversationLookup(state),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);
export const SmartSettingsView = smart(SettingsViewInner);
