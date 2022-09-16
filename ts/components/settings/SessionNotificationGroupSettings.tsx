import React from 'react';
// tslint:disable-next-line: no-submodule-imports
import useUpdate from 'react-use/lib/useUpdate';
import styled from 'styled-components';
import { SettingsKey } from '../../data/settings-key';
import { Notifications } from '../../util/notifications';
import { SessionButton } from '../basic/SessionButton';
import { SessionRadioGroup } from '../basic/SessionRadioGroup';
import { SpacerLG } from '../basic/Text';
import { SessionSettingsItemWrapper, SessionToggleWithDescription } from './SessionSettingListItem';
// tslint:disable: use-simple-attributes

enum NOTIFICATION {
  MESSAGE = 'message',
  NAME = 'name',
  COUNT = 'count',
  OFF = 'off',
}

const StyledButtonContainer = styled.div`
  display: flex;
  width: min-content;
  flex-direction: column;
  padding-inline-start: var(--margins-lg);
`;

export const SessionNotificationGroupSettings = (props: { hasPassword: boolean | null }) => {
  const forceUpdate = useUpdate();

  if (props.hasPassword === null) {
    return null;
  }
  const initialItem =
    window.getSettingValue(SettingsKey.settingsNotification) || NOTIFICATION.MESSAGE;

  const notificationsAreEnabled = initialItem && initialItem !== NOTIFICATION.OFF;

  const items = [
    {
      label: window.i18n('nameAndMessage'),
      value: NOTIFICATION.MESSAGE,
    },
    {
      label: window.i18n('nameOnly'),
      value: NOTIFICATION.NAME,
    },
    {
      label: window.i18n('noNameOrMessage'),
      value: NOTIFICATION.COUNT,
    },
  ];

  const onClickPreview = () => {
    if (!notificationsAreEnabled) {
      return;
    }
    Notifications.addNotification(
      {
        conversationId: `preview-notification-${Date.now()}`,
        message:
          items.find(m => m.value === initialItem)?.label ||
          window?.i18n?.('messageBody') ||
          'Message body',
        title: window.i18n('notificationPreview'),
        iconUrl: null,
        isExpiringMessage: false,
        messageSentAt: Date.now(),
      },
      true
    );
  };

  return (
    <>
      <SessionToggleWithDescription
        onClickToggle={async () => {
          await window.setSettingValue(
            SettingsKey.settingsNotification,
            notificationsAreEnabled ? NOTIFICATION.OFF : NOTIFICATION.MESSAGE
          );
          forceUpdate();
        }}
        title={window.i18n('notificationsSettingsTitle')}
        active={notificationsAreEnabled}
      />
      {notificationsAreEnabled ? (
        <SessionSettingsItemWrapper
          title={window.i18n('notificationsSettingsContent')}
          description={window.i18n('notificationSettingsDialog')}
          inline={false}
        >
          <SessionRadioGroup
            initialItem={initialItem}
            group={SettingsKey.settingsNotification}
            items={items}
            onClick={async (selectedRadioValue: string) => {
              await window.setSettingValue(SettingsKey.settingsNotification, selectedRadioValue);
              forceUpdate();
            }}
          />
          <StyledButtonContainer>
            <SpacerLG />
            <SessionButton text={window.i18n('notificationPreview')} onClick={onClickPreview} />
          </StyledButtonContainer>
        </SessionSettingsItemWrapper>
      ) : null}
    </>
  );
};
