import React from 'react';

import { DefaultTheme } from 'styled-components';
import { SmartSessionConversation } from '../state/smart/SessionConversation';
import {
  SessionSettingCategory,
  SmartSettingsView,
} from './session/settings/SessionSettings';

const FilteredSettingsView = SmartSettingsView as any;

interface Props {
  focusedSettingsSection?: SessionSettingCategory;
}

export class SessionMainPanel extends React.Component<Props> {
  public constructor(props: Props) {
    super(props);
  }

  public render() {
    const isSettingsView = this.props.focusedSettingsSection !== undefined;

    return isSettingsView
      ? this.renderSettings()
      : this.renderSessionConversation();
  }

  private renderSettings() {
    const category = this.props.focusedSettingsSection;

    return <FilteredSettingsView category={category} />;
  }

  private renderSessionConversation() {
    return (
      <div className="session-conversation">
        <SmartSessionConversation />
      </div>
    );
  }
}
