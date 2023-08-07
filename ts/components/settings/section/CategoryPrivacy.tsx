/* eslint-disable @typescript-eslint/no-misused-promises */
import React from 'react';

import useUpdate from 'react-use/lib/useUpdate';
import { SettingsKey } from '../../../data/settings-key';
import { ConversationTypeEnum } from '../../../models/conversationAttributes';
import { updateConfirmModal } from '../../../state/ducks/modalDialog';
import { SessionButtonColor } from '../../basic/SessionButton';
import { SpacerLG } from '../../basic/Text';
import { TypingBubble } from '../../conversation/TypingBubble';

import { SessionSettingButtonItem, SessionToggleWithDescription } from '../SessionSettingListItem';
import { displayPasswordModal } from '../SessionSettings';
import { Storage } from '../../../util/storage';
import { useHasLinkPreviewEnabled } from '../../../state/selectors/settings';

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

  if (props.hasPassword !== null) {
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

        {!props.hasPassword && (
          <SessionSettingButtonItem
            title={window.i18n('setAccountPasswordTitle')}
            description={window.i18n('setAccountPasswordDescription')}
            onClick={() => {
              displayPasswordModal('set', props.onPasswordUpdated);
            }}
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
            buttonText={window.i18n('changePassword')}
            dataTestId="change-password-settings-button"
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
            dataTestId="remove-password-settings-button"
          />
        )}
      </>
    );
  }
  return null;
};
