import React from 'react';
// tslint:disable-next-line: no-submodule-imports
import useUpdate from 'react-use/lib/useUpdate';
import { Data, hasLinkPreviewPopupBeenDisplayed } from '../../../data/data';
import { SettingsKey } from '../../../data/settings-key';
import { ConversationTypeEnum } from '../../../models/conversationAttributes';
import { updateConfirmModal } from '../../../state/ducks/modalDialog';
import { SessionButtonColor } from '../../basic/SessionButton';
import { SpacerLG } from '../../basic/Text';
import { TypingBubble } from '../../conversation/TypingBubble';

import { SessionSettingButtonItem, SessionToggleWithDescription } from '../SessionSettingListItem';
import { displayPasswordModal } from '../SessionSettings';

async function toggleLinkPreviews(isToggleOn: boolean, setIsToggleOn: (value: boolean) => void) {
  if (!isToggleOn) {
    window.inboxStore?.dispatch(
      updateConfirmModal({
        title: window.i18n('linkPreviewsTitle'),
        message: window.i18n('linkPreviewsConfirmMessage'),
        okTheme: SessionButtonColor.Danger,
        onClickOk: async () => {
          const newValue = !isToggleOn;
          await window.setSettingValue(SettingsKey.settingsLinkPreview, newValue);
          setIsToggleOn(newValue);
        },
      })
    );
  } else {
    await Data.createOrUpdateItem({ id: hasLinkPreviewPopupBeenDisplayed, value: false });
    setIsToggleOn(false);
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
  const [isLinkPreviewsOn, setIsLinkPreviewsOn] = React.useState(
    Boolean(window.getSettingValue(SettingsKey.settingsLinkPreview))
  );

  const forceUpdate = useUpdate();

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
          onClickToggle={async () => {
            await toggleLinkPreviews(isLinkPreviewsOn, setIsLinkPreviewsOn);
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
