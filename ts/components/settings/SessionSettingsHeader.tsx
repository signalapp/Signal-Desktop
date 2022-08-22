import React from 'react';
import styled from 'styled-components';
import { LocalizerKeys } from '../../types/LocalizerKeys';
import { missingCaseError } from '../../util';
import { SessionSettingCategory, SettingsViewProps } from './SessionSettings';

type Props = Pick<SettingsViewProps, 'category'>;

export const SettingsHeader = (props: Props) => {
  const { category } = props;

  let categoryLocalized: LocalizerKeys | null = null;
  switch (category) {
    case SessionSettingCategory.Appearance:
      categoryLocalized = 'appearanceSettingsTitle';
      break;
    case SessionSettingCategory.Conversations:
      categoryLocalized = 'blockedSettingsTitle';
      break;
    case SessionSettingCategory.Notifications:
      categoryLocalized = 'notificationsSettingsTitle';
      break;
    case SessionSettingCategory.Help:
      categoryLocalized = 'helpSettingsTitle';
      break;
    case SessionSettingCategory.Permissions:
      categoryLocalized = 'permissionsSettingsTitle';
      break;
    case SessionSettingCategory.Privacy:
      categoryLocalized = 'privacySettingsTitle';
      break;
    default:
      throw missingCaseError('SettingsHeader' as never);
  }

  const categoryTitle = window.i18n(categoryLocalized);

  return (
    <StyledSettingsHeader>
      <StyledHeaderTittle>{categoryTitle}</StyledHeaderTittle>
    </StyledSettingsHeader>
  );
};

const StyledSettingsHeader = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  height: var(--main-view-header-height);
  background: var(--color-cell-background);
`;

const StyledHeaderTittle = styled.div`
  line-height: var(--main-view-header-height);
  font-weight: bold;
  font-size: var(--font-size-lg);
  text-align: center;
  flex-grow: 1;
`;
