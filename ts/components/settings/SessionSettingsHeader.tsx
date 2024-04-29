import React from 'react';
import styled from 'styled-components';
import { assertUnreachable } from '../../types/sqlSharedTypes';
import { SettingsViewProps } from './SessionSettings';

type Props = Pick<SettingsViewProps, 'category'>;

const StyledSettingsHeader = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  height: var(--main-view-header-height);
`;

const StyledHeaderTittle = styled.div`
  line-height: var(--main-view-header-height);
  font-weight: bold;
  font-size: var(--font-size-lg);
  text-align: center;
  flex-grow: 1;
`;

export const SettingsHeader = (props: Props) => {
  const { category } = props;

  let categoryTitle: string | null = null;
  switch (category) {
    case 'appearance':
      categoryTitle = window.i18n('appearanceSettingsTitle');
      break;
    case 'conversations':
      categoryTitle = window.i18n('conversationsSettingsTitle');
      break;
    case 'notifications':
      categoryTitle = window.i18n('notificationsSettingsTitle');
      break;
    case 'help':
      categoryTitle = window.i18n('helpSettingsTitle');
      break;
    case 'permissions':
      categoryTitle = window.i18n('permissionsSettingsTitle');
      break;
    case 'privacy':
      categoryTitle = window.i18n('privacySettingsTitle');
      break;
    case 'clearData':
    case 'messageRequests':
    case 'recoveryPhrase':
      throw new Error(`no header for should be tried to be rendered for "${category}"`);

    default:
      assertUnreachable(category, `SettingsHeader "${category}"`);
  }

  return (
    <StyledSettingsHeader>
      <StyledHeaderTittle>{categoryTitle}</StyledHeaderTittle>
    </StyledSettingsHeader>
  );
};
