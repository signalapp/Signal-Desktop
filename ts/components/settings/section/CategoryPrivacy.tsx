import React from 'react';
// tslint:disable-next-line: no-submodule-imports
import useUpdate from 'react-use/lib/useUpdate';
import { Data, hasLinkPreviewPopupBeenDisplayed } from '../../../data/data';
import { SettingsKey } from '../../../data/settings-key';
import { sessionPassword, updateConfirmModal } from '../../../state/ducks/modalDialog';
import { SessionButtonColor, SessionButtonType } from '../../basic/SessionButton';
import { PasswordAction } from '../../dialog/SessionPasswordDialog';

import { SessionSettingButtonItem, SessionToggleWithDescription } from '../SessionSettingListItem';

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

async function toggleLinkPreviews() {
  const newValue = !window.getSettingValue(SettingsKey.settingsLinkPreview);
  window.setSettingValue(SettingsKey.settingsLinkPreview, newValue);
  if (!newValue) {
    await Data.createOrUpdateItem({ id: hasLinkPreviewPopupBeenDisplayed, value: false });
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

export const SettingsCategoryPrivacy = (props: {
  hasPassword: boolean | null;
  onPasswordUpdated: (action: string) => void;
}) => {
  const forceUpdate = useUpdate();
  const isLinkPreviewsOn = Boolean(window.getSettingValue(SettingsKey.settingsLinkPreview));

  if (props.hasPassword !== null) {
    return (
      <>
        <SessionToggleWithDescription
          onClickToggle={() => {
            const old = Boolean(window.getSettingValue(SettingsKey.settingsReadReceipt));
            window.setSettingValue(SettingsKey.settingsReadReceipt, !old);
            forceUpdate();
          }}
          title={window.i18n('readReceiptSettingTitle')}
          description={window.i18n('readReceiptSettingDescription')}
          active={window.getSettingValue(SettingsKey.settingsReadReceipt)}
        />
        <SessionToggleWithDescription
          onClickToggle={() => {
            const old = Boolean(window.getSettingValue(SettingsKey.settingsTypingIndicator));
            window.setSettingValue(SettingsKey.settingsTypingIndicator, !old);
            forceUpdate();
          }}
          title={window.i18n('typingIndicatorsSettingTitle')}
          description={window.i18n('typingIndicatorsSettingDescription')}
          active={Boolean(window.getSettingValue(SettingsKey.settingsTypingIndicator))}
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

        {!props.hasPassword && (
          <SessionSettingButtonItem
            title={window.i18n('setAccountPasswordTitle')}
            description={window.i18n('setAccountPasswordDescription')}
            onClick={() => {
              displayPasswordModal('set', props.onPasswordUpdated);
            }}
            buttonColor={SessionButtonColor.Green}
            buttonType={SessionButtonType.BrandOutline}
            buttonText={window.i18n('setPassword')}
            dataTestId={'set-password-button'}
          />
        )}
        {props.hasPassword && (
          <SessionSettingButtonItem
            title={window.i18n('changeAccountPasswordTitle')}
            description={window.i18n('changeAccountPasswordDescription')}
            onClick={() => {
              displayPasswordModal('change', props.onPasswordUpdated);
            }}
            buttonColor={SessionButtonColor.Green}
            buttonType={SessionButtonType.BrandOutline}
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
            buttonType={SessionButtonType.BrandOutline}
            buttonText={window.i18n('removePassword')}
          />
        )}
      </>
    );
  }
  return null;
};
