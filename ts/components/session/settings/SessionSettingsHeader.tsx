import React from 'react';
import { SettingsViewProps } from './SessionSettings';

type Props = Pick<SettingsViewProps, 'category'> & {
  categoryTitle: string;
};

export const SettingsHeader = (props: Props) => {
  const { categoryTitle } = props;
  return (
    <div className="session-settings-header">
      <div className="session-settings-header-title">{categoryTitle}</div>
    </div>
  );
};
