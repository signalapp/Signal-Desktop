import React from 'react';

import { SmartSessionConversation } from '../state/smart/SessionConversation';
import {
  SessionSettingCategory,
  SmartSettingsView,
} from './session/settings/SessionSettings';

const FilteredSettingsView = SmartSettingsView as any;

type Props = {
  focusedSettingsSection?: SessionSettingCategory;
};

export const SessionMainPanel = (props: Props) => {
  const isSettingsView = props.focusedSettingsSection !== undefined;

  if (isSettingsView) {
    return <FilteredSettingsView category={props.focusedSettingsSection} />;
  }
  return (
    <div className="session-conversation">
      <SmartSessionConversation />
    </div>
  );
};
