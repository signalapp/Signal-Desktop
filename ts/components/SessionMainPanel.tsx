import React from 'react';
import { useSelector } from 'react-redux';
import { getFocusedSettingsSection } from '../state/selectors/section';

import { SmartSessionConversation } from '../state/smart/SessionConversation';
import { SmartSettingsView } from './session/settings/SessionSettings';

const FilteredSettingsView = SmartSettingsView as any;

export const SessionMainPanel = () => {
  const focusedSettingsSection = useSelector(getFocusedSettingsSection);
  const isSettingsView = focusedSettingsSection !== undefined;

  if (isSettingsView) {
    return <FilteredSettingsView category={focusedSettingsSection} />;
  }
  return (
    <div className="session-conversation">
      <SmartSessionConversation />
    </div>
  );
};
