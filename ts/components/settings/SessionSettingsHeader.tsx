import styled from 'styled-components';
import { assertUnreachable } from '../../types/sqlSharedTypes';
import { SessionSettingCategory, SettingsViewProps } from './SessionSettings';

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
    case SessionSettingCategory.Appearance:
      categoryTitle = window.i18n('appearanceSettingsTitle');
      break;
    case SessionSettingCategory.Conversations:
      categoryTitle = window.i18n('conversationsSettingsTitle');
      break;
    case SessionSettingCategory.Notifications:
      categoryTitle = window.i18n('notificationsSettingsTitle');
      break;
    case SessionSettingCategory.Help:
      categoryTitle = window.i18n('helpSettingsTitle');
      break;
    case SessionSettingCategory.Permissions:
      categoryTitle = window.i18n('permissionsSettingsTitle');
      break;
    case SessionSettingCategory.Privacy:
      categoryTitle = window.i18n('privacySettingsTitle');
      break;
    case SessionSettingCategory.ClearData:
    case SessionSettingCategory.MessageRequests:
    case SessionSettingCategory.RecoveryPhrase:
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
