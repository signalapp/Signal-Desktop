import React from 'react';
// tslint:disable-next-line: no-submodule-imports
import useUpdate from 'react-use/lib/useUpdate';
import { sessionPassword, updateConfirmModal } from '../../../../state/ducks/modalDialog';
import { toggleMessageRequests } from '../../../../state/ducks/userConfig';
import { PasswordAction } from '../../../dialog/SessionPasswordDialog';
import { SessionButtonColor } from '../../SessionButton';
import { SessionSettingButtonItem, SessionToggleWithDescription } from '../SessionSettingListItem';

const settingsReadReceipt = 'read-receipt-setting';
const settingsTypingIndicator = 'typing-indicators-setting';
const settingsAutoUpdate = 'auto-update';

const toggleCallMediaPermissions = async (triggerUIUpdate: () => void) => {
  const currentValue = window.getCallMediaPermissions();
  if (!currentValue) {
    window.inboxStore?.dispatch(
      updateConfirmModal({
        message: window.i18n('callMediaPermissionsDialogContent'),
        okTheme: SessionButtonColor.Danger,
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

export const SettingsCategoryPrivacy = (props: {
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

        {window.lokiFeatureFlags.useCallMessage && (
          <SessionToggleWithDescription
            onClickToggle={async () => {
              await toggleCallMediaPermissions(forceUpdate);
              forceUpdate();
            }}
            title={window.i18n('callMediaPermissionsTitle')}
            description={window.i18n('callMediaPermissionsDescription')}
            active={Boolean(window.getCallMediaPermissions())}
          />
        )}
        <SessionToggleWithDescription
          onClickToggle={() => {
            const old = Boolean(window.getSettingValue(settingsReadReceipt));
            window.setSettingValue(settingsReadReceipt, !old);
            forceUpdate();
          }}
          title={window.i18n('readReceiptSettingTitle')}
          description={window.i18n('readReceiptSettingDescription')}
          active={window.getSettingValue(settingsReadReceipt)}
        />
        <SessionToggleWithDescription
          onClickToggle={() => {
            const old = Boolean(window.getSettingValue(settingsTypingIndicator));
            window.setSettingValue(settingsTypingIndicator, !old);
            forceUpdate();
          }}
          title={window.i18n('typingIndicatorsSettingTitle')}
          description={window.i18n('typingIndicatorsSettingDescription')}
          active={Boolean(window.getSettingValue(settingsTypingIndicator))}
        />
        <SessionToggleWithDescription
          onClickToggle={() => {
            const old = Boolean(window.getSettingValue(settingsAutoUpdate));
            window.setSettingValue(settingsAutoUpdate, !old);
            forceUpdate();
          }}
          title={window.i18n('autoUpdateSettingTitle')}
          description={window.i18n('autoUpdateSettingDescription')}
          active={Boolean(window.getSettingValue(settingsAutoUpdate))}
        />
        <SessionToggleWithDescription
          onClickToggle={() => {
            // const old = Boolean(window.getSettingValue(settingsAutoUpdate));
            // window.setSettingValue(settingsAutoUpdate, !old);
            window.inboxStore?.dispatch(toggleMessageRequests());
            forceUpdate();
          }}
          title={window.i18n('messageRequests')}
          description={window.i18n('messageRequestsDescription')}
          active={Boolean(window.getSettingValue(settingsAutoUpdate))}
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
