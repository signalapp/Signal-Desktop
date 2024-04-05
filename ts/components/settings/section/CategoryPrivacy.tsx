/* eslint-disable @typescript-eslint/no-misused-promises */
import React from 'react';

import useUpdate from 'react-use/lib/useUpdate';
import { SettingsKey } from '../../../data/settings-key';
import { ConversationTypeEnum } from '../../../models/conversationAttributes';
import { updateConfirmModal } from '../../../state/ducks/modalDialog';
import { SessionButtonColor } from '../../basic/SessionButton';
import { SpacerLG } from '../../basic/Text';
import { TypingBubble } from '../../conversation/TypingBubble';

import { UserUtils } from '../../../session/utils';
import { ConfigurationSync } from '../../../session/utils/job_runners/jobs/ConfigurationSyncJob';
import { SessionUtilUserProfile } from '../../../session/utils/libsession/libsession_utils_user_profile';
import {
  useHasBlindedMsgRequestsEnabled,
  useHasLinkPreviewEnabled,
} from '../../../state/selectors/settings';
import { Storage } from '../../../util/storage';
import { SessionSettingButtonItem, SessionToggleWithDescription } from '../SessionSettingListItem';
import { displayPasswordModal } from '../SessionSettings';

async function toggleLinkPreviews(isToggleOn: boolean, forceUpdate: () => void) {
  if (!isToggleOn) {
    window.inboxStore?.dispatch(
      updateConfirmModal({
        title: window.i18n('linkPreviewsTitle'),
        message: window.i18n('linkPreviewsConfirmMessage'),
        okTheme: SessionButtonColor.Danger,
        onClickOk: async () => {
          const newValue = !isToggleOn;
          await window.setSettingValue(SettingsKey.settingsLinkPreview, newValue);
          forceUpdate();
        },
        onClickClose: () => {
          window.inboxStore?.dispatch(updateConfirmModal(null));
        },
      })
    );
  } else {
    await window.setSettingValue(SettingsKey.settingsLinkPreview, false);
    await Storage.put(SettingsKey.hasLinkPreviewPopupBeenDisplayed, false);
    forceUpdate();
  }
}

const TypingBubbleItem = () => {
  return (
    <>
      <SpacerLG />
      <TypingBubble conversationType={ConversationTypeEnum.PRIVATE} isTyping={true} />
    </>
  );
};

export const SettingsCategoryPrivacy = (props: {
  hasPassword: boolean | null;
  onPasswordUpdated: (action: string) => void;
}) => {
  const forceUpdate = useUpdate();
  const isLinkPreviewsOn = useHasLinkPreviewEnabled();
  const areBlindedRequestsEnabled = useHasBlindedMsgRequestsEnabled();

  return (
    <>
      <SessionToggleWithDescription
        onClickToggle={async () => {
          const old = Boolean(window.getSettingValue(SettingsKey.settingsReadReceipt));
          await window.setSettingValue(SettingsKey.settingsReadReceipt, !old);
          forceUpdate();
        }}
        title={window.i18n('readReceiptSettingTitle')}
        description={window.i18n('readReceiptSettingDescription')}
        active={window.getSettingValue(SettingsKey.settingsReadReceipt)}
        dataTestId="enable-read-receipts"
      />
      <SessionToggleWithDescription
        onClickToggle={async () => {
          const old = Boolean(window.getSettingValue(SettingsKey.settingsTypingIndicator));
          await window.setSettingValue(SettingsKey.settingsTypingIndicator, !old);
          forceUpdate();
        }}
        title={window.i18n('typingIndicatorsSettingTitle')}
        description={window.i18n('typingIndicatorsSettingDescription')}
        active={Boolean(window.getSettingValue(SettingsKey.settingsTypingIndicator))}
        childrenDescription={<TypingBubbleItem />}
      />
      <SessionToggleWithDescription
        onClickToggle={() => {
          void toggleLinkPreviews(isLinkPreviewsOn, forceUpdate);
        }}
        title={window.i18n('linkPreviewsTitle')}
        description={window.i18n('linkPreviewDescription')}
        active={isLinkPreviewsOn}
      />
      <SessionToggleWithDescription
        onClickToggle={async () => {
          const toggledValue = !areBlindedRequestsEnabled;
          await window.setSettingValue(SettingsKey.hasBlindedMsgRequestsEnabled, toggledValue);
          await SessionUtilUserProfile.insertUserProfileIntoWrapper(
            UserUtils.getOurPubKeyStrFromCache()
          );
          await ConfigurationSync.queueNewJobIfNeeded();
          forceUpdate();
        }}
        title={window.i18n('blindedMsgReqsSettingTitle')}
        description={window.i18n('blindedMsgReqsSettingDesc')}
        active={areBlindedRequestsEnabled}
      />

      {!props.hasPassword ? (
        <SessionSettingButtonItem
          title={window.i18n('setAccountPasswordTitle')}
          description={window.i18n('setAccountPasswordDescription')}
          onClick={() => {
            displayPasswordModal('set', props.onPasswordUpdated);
          }}
          buttonText={window.i18n('setPassword')}
          dataTestId={'set-password-button'}
        />
      ) : (
        <>
          {/* We have a password, let's show the 'change' and 'remove' password buttons */}
          <SessionSettingButtonItem
            title={window.i18n('changeAccountPasswordTitle')}
            description={window.i18n('changeAccountPasswordDescription')}
            onClick={() => {
              displayPasswordModal('change', props.onPasswordUpdated);
            }}
            buttonText={window.i18n('changePassword')}
            dataTestId="change-password-settings-button"
          />
          <SessionSettingButtonItem
            title={window.i18n('removeAccountPasswordTitle')}
            description={window.i18n('removeAccountPasswordDescription')}
            onClick={() => {
              displayPasswordModal('remove', props.onPasswordUpdated);
            }}
            buttonColor={SessionButtonColor.Danger}
            buttonText={window.i18n('removePassword')}
            dataTestId="remove-password-settings-button"
          />
        </>
      )}
    </>
  );
};
