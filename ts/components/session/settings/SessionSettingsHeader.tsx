import React from 'react';
import { SettingsViewProps } from './SessionSettings';
import { DefaultTheme, withTheme } from 'styled-components';

interface Props extends SettingsViewProps {
  categoryTitle: string;
  theme: DefaultTheme;
}

const SettingsHeaderInner = (props: Props) => {
  const { categoryTitle } = props;
  return (
    <div className="session-settings-header">
      <div className="session-settings-header-title">{categoryTitle}</div>
    </div>
  );
}

export const SettingsHeader = withTheme(SettingsHeaderInner);
