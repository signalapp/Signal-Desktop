import React from 'react';
import { SessionRadioGroup } from '../basic/SessionRadioGroup';
import { SessionSettingsItemWrapper } from './SessionSettingListItem';

export const SessionNotificationGroupSettings = (props: { hasPassword: boolean | null }) => {
  if (props.hasPassword === null) {
    return null;
  }

  const initialItem = window.getSettingValue('notification-setting') || 'message';

  const items = [
    {
      label: window.i18n('nameAndMessage'),
      value: 'message',
    },
    {
      label: window.i18n('nameOnly'),
      value: 'name',
    },
    {
      label: window.i18n('noNameOrMessage'),
      value: 'count',
    },
    {
      label: window.i18n('disableNotifications'),
      value: 'off',
    },
  ];
  return (
    <SessionSettingsItemWrapper title={window.i18n('notificationSettingsDialog')} inline={false}>
      <SessionRadioGroup
        initialItem={initialItem}
        group={'notification-setting'}
        items={items}
        onClick={(selectedRadioValue: string) => {
          window.setSettingValue('notification-setting', selectedRadioValue);
        }}
      />
    </SessionSettingsItemWrapper>
  );
};
