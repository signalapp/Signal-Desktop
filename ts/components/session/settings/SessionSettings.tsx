import React from 'react';

import { SettingsHeader } from './SessionSettingsHeader';
import { SessionSettingButtonItem, SessionToggleWithDescription } from './SessionSettingListItem';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../SessionButton';
import { PasswordUtil } from '../../../util';
import { useDispatch, useSelector } from 'react-redux';
import {
  createOrUpdateItem,
  getPasswordHash,
  hasLinkPreviewPopupBeenDisplayed,
} from '../../../../ts/data/data';
import { ipcRenderer, shell } from 'electron';
import { SessionIconButton } from '../icon';
import autoBind from 'auto-bind';
import { SessionNotificationGroupSettings } from './SessionNotificationGroupSettings';
import { sessionPassword, updateConfirmModal } from '../../../state/ducks/modalDialog';
import { ToastUtils } from '../../../session/utils';
import { getAudioAutoplay } from '../../../state/selectors/userConfig';
import { toggleAudioAutoplay } from '../../../state/ducks/userConfig';
// tslint:disable-next-line: no-submodule-imports
import useUpdate from 'react-use/lib/useUpdate';
import { PasswordAction } from '../../dialog/SessionPasswordDialog';
import { BlockedUserSettings } from './BlockedUserSettings';
import { ZoomingSessionSlider } from './ZoomingSessionSlider';

export function getMediaPermissionsSettings() {
  return window.getSettingValue('media-permissions');
}

export function getCallMediaPermissionsSettings() {
  return window.getSettingValue('call-media-permissions');
}

export enum SessionSettingCategory {
  Appearance = 'appearance',
  Privacy = 'privacy',
  Notifications = 'notifications',
  Blocked = 'blocked',
}

export interface SettingsViewProps {
  category: SessionSettingCategory;
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

async function toggleLinkPreviews() {
  const newValue = !window.getSettingValue('link-preview-setting');
  window.setSettingValue('link-preview-setting', newValue);
  if (!newValue) {
    await createOrUpdateItem({ id: hasLinkPreviewPopupBeenDisplayed, value: false });
  } else {
    window.inboxStore?.dispatch(
      updateConfirmModal({
        title: window.i18n('linkPreviewsTitle'),
        message: window.i18n('linkPreviewsConfirmMessage'),
        okTheme: SessionButtonColor.Danger,
      })
    );
  }
}

async function toggleStartInTray() {
  try {
    const newValue = !(await window.getStartInTray());

    // make sure to write it here too, as this is the value used on the UI to mark the toggle as true/false
    window.setSettingValue('start-in-tray-setting', newValue);
    await window.setStartInTray(newValue);
    if (!newValue) {
      ToastUtils.pushRestartNeeded();
    }
  } catch (e) {
    window.log.warn('start in tray change error:', e);
  }
}

const toggleCallMediaPermissions = async (triggerUIUpdate: () => void) => {
  const currentValue = window.getCallMediaPermissions();
  if (!currentValue) {
    window.inboxStore?.dispatch(
      updateConfirmModal({
        message: window.i18n('callMediaPermissionsDialogContent'),
        okTheme: SessionButtonColor.Green,
        onClickOk: async () => {
          await window.toggleCallMediaPermissionsTo(true);
          triggerUIUpdate();
        },
        onClickCancel: async () => {
          await window.toggleCallMediaPermissionsTo(false);
          triggerUIUpdate();
        },
      })
    );
  } else {
    await window.toggleCallMediaPermissionsTo(false);
    triggerUIUpdate();
  }
};

const SettingsCategoryAppearance = (props: { hasPassword: boolean | null }) => {
  const dispatch = useDispatch();
  const forceUpdate = useUpdate();
  const audioAutoPlay = useSelector(getAudioAutoplay);

  if (props.hasPassword !== null) {
    const isHideMenuBarActive =
      window.getSettingValue('hide-menu-bar') === undefined
        ? true
        : window.getSettingValue('hide-menu-bar');

    const isSpellCheckActive =
      window.getSettingValue('spell-check') === undefined
        ? true
        : window.getSettingValue('spell-check');

    const isLinkPreviewsOn = Boolean(window.getSettingValue('link-preview-setting'));
    const isStartInTrayActive = Boolean(window.getSettingValue('start-in-tray-setting'));

    return (
      <>
        {window.Signal.Types.Settings.isHideMenuBarSupported() && (
          <SessionToggleWithDescription
            onClickToggle={() => {
              window.toggleMenuBar();
              forceUpdate();
            }}
            title={window.i18n('hideMenuBarTitle')}
            description={window.i18n('hideMenuBarDescription')}
            active={isHideMenuBarActive}
          />
        )}
        <SessionToggleWithDescription
          onClickToggle={() => {
            window.toggleSpellCheck();
            forceUpdate();
          }}
          title={window.i18n('spellCheckTitle')}
          description={window.i18n('spellCheckDescription')}
          active={isSpellCheckActive}
        />

        <SessionToggleWithDescription
          onClickToggle={async () => {
            await toggleLinkPreviews();
            forceUpdate();
          }}
          title={window.i18n('linkPreviewsTitle')}
          description={window.i18n('linkPreviewDescription')}
          active={isLinkPreviewsOn}
        />
        <SessionToggleWithDescription
          onClickToggle={async () => {
            await toggleStartInTray();
            forceUpdate();
          }}
          title={window.i18n('startInTrayTitle')}
          description={window.i18n('startInTrayDescription')}
          active={isStartInTrayActive}
        />
        <SessionToggleWithDescription
          onClickToggle={() => {
            dispatch(toggleAudioAutoplay());
            forceUpdate();
          }}
          title={window.i18n('audioMessageAutoplayTitle')}
          description={window.i18n('audioMessageAutoplayDescription')}
          active={audioAutoPlay}
        />
        <ZoomingSessionSlider />
        <SessionSettingButtonItem
          title={window.i18n('surveyTitle')}
          onClick={() => void shell.openExternal('https://getsession.org/survey')}
          buttonColor={SessionButtonColor.Primary}
          buttonText={window.i18n('goToOurSurvey')}
        />
        <SessionSettingButtonItem
          title={window.i18n('helpUsTranslateSession')}
          onClick={() => void shell.openExternal('https://crowdin.com/project/session-desktop/')}
          buttonColor={SessionButtonColor.Primary}
          buttonText={window.i18n('translation')}
        />
        <SessionSettingButtonItem
          onClick={() => {
            ipcRenderer.send('show-debug-log');
          }}
          buttonColor={SessionButtonColor.Primary}
          buttonText={window.i18n('showDebugLog')}
        />
      </>
    );
  }
  return null;
};

const SettingsCategoryPrivacy = (props: {
  hasPassword: boolean | null;
  onPasswordUpdated: (action: string) => void;
}) => {
  const forceUpdate = useUpdate();

  if (props.hasPassword !== null) {
    return (
      <>
        <SessionToggleWithDescription
          onClickToggle={async () => {
            await window.toggleMediaPermissions();
            forceUpdate();
          }}
          title={window.i18n('mediaPermissionsTitle')}
          description={window.i18n('mediaPermissionsDescription')}
          active={Boolean(window.getSettingValue('media-permissions'))}
        />

        <SessionToggleWithDescription
          onClickToggle={async () => {
            await toggleCallMediaPermissions(forceUpdate);
            forceUpdate();
          }}
          title={window.i18n('callMediaPermissionsTitle')}
          description={window.i18n('callMediaPermissionsDescription')}
          active={Boolean(window.getCallMediaPermissions())}
        />
        <SessionToggleWithDescription
          onClickToggle={() => {
            const old = Boolean(window.getSettingValue('read-receipt-setting'));
            window.setSettingValue('read-receipt-setting', !old);
            forceUpdate();
          }}
          title={window.i18n('readReceiptSettingTitle')}
          description={window.i18n('readReceiptSettingDescription')}
          active={window.getSettingValue('read-receipt-setting')}
        />
        <SessionToggleWithDescription
          onClickToggle={() => {
            const old = Boolean(window.getSettingValue('typing-indicators-setting'));
            window.setSettingValue('typing-indicators-setting', !old);
            forceUpdate();
          }}
          title={window.i18n('typingIndicatorsSettingTitle')}
          description={window.i18n('typingIndicatorsSettingDescription')}
          active={Boolean(window.getSettingValue('typing-indicators-setting'))}
        />
        <SessionToggleWithDescription
          onClickToggle={() => {
            const old = Boolean(window.getSettingValue('auto-update'));
            window.setSettingValue('auto-update', !old);
            forceUpdate();
          }}
          title={window.i18n('autoUpdateSettingTitle')}
          description={window.i18n('autoUpdateSettingDescription')}
          active={Boolean(window.getSettingValue('auto-update'))}
        />
        {!props.hasPassword && (
          <SessionSettingButtonItem
            title={window.i18n('setAccountPasswordTitle')}
            description={window.i18n('setAccountPasswordDescription')}
            onClick={() => {
              displayPasswordModal('set', props.onPasswordUpdated);
            }}
            buttonColor={SessionButtonColor.Primary}
            buttonText={window.i18n('setPassword')}
          />
        )}
        {props.hasPassword && (
          <SessionSettingButtonItem
            title={window.i18n('changeAccountPasswordTitle')}
            description={window.i18n('changeAccountPasswordDescription')}
            onClick={() => {
              displayPasswordModal('change', props.onPasswordUpdated);
            }}
            buttonColor={SessionButtonColor.Primary}
            buttonText={window.i18n('changePassword')}
          />
        )}
        {props.hasPassword && (
          <SessionSettingButtonItem
            title={window.i18n('removeAccountPasswordTitle')}
            description={window.i18n('removeAccountPasswordDescription')}
            onClick={() => {
              displayPasswordModal('remove', props.onPasswordUpdated);
            }}
            buttonColor={SessionButtonColor.Danger}
            buttonText={window.i18n('removePassword')}
          />
        )}
      </>
    );
  }
  return null;
};

export class SmartSettingsView extends React.Component<SettingsViewProps, State> {
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

  public renderSettingsPrivacy() {
    if (this.state.hasPassword !== null) {
      return <SessionNotificationGroupSettings hasPassword={this.state.hasPassword} />;
    }
    return null;
  }

  /* tslint:disable-next-line:max-func-body-length */
  public renderSettingInCategory() {
    const { category } = this.props;

    if (this.state.hasPassword === null) {
      return null;
    }
    if (category === SessionSettingCategory.Blocked) {
      // special case for blocked user
      return <BlockedUserSettings />;
    }

    if (category === SessionSettingCategory.Appearance) {
      return <SettingsCategoryAppearance hasPassword={this.state.hasPassword} />;
    }

    if (category === SessionSettingCategory.Notifications) {
      return <SessionNotificationGroupSettings hasPassword={this.state.hasPassword} />;
    }

    if (category === SessionSettingCategory.Privacy) {
      return (
        <SettingsCategoryPrivacy
          onPasswordUpdated={this.onPasswordUpdated}
          hasPassword={this.state.hasPassword}
        />
      );
    }
    return <SessionNotificationGroupSettings hasPassword={this.state.hasPassword} />;
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

function displayPasswordModal(
  passwordAction: PasswordAction,
  onPasswordUpdated: (action: string) => void
) {
  window.inboxStore?.dispatch(
    sessionPassword({
      passwordAction,
      onOk: () => {
        onPasswordUpdated(passwordAction);
      },
    })
  );
}
