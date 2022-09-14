import React from 'react';
import styled from 'styled-components';

import { LeftPaneSectionHeader } from './LeftPaneSectionHeader';
import { useDispatch, useSelector } from 'react-redux';
import {
  SectionType,
  setOverlayMode,
  showLeftPaneSection,
  showSettingsSection,
} from '../../state/ducks/section';
import { getFocusedSettingsSection } from '../../state/selectors/section';
import { recoveryPhraseModal, updateDeleteAccountModal } from '../../state/ducks/modalDialog';
import { SessionIcon } from '../icon';
import { SessionSettingCategory } from '../settings/SessionSettings';
import { resetConversationExternal } from '../../state/ducks/conversations';

const getCategories = () => {
  return [
    {
      id: SessionSettingCategory.Privacy,
      title: window.i18n('privacySettingsTitle'),
    },
    {
      id: SessionSettingCategory.Notifications,
      title: window.i18n('notificationsSettingsTitle'),
    },
    {
      id: SessionSettingCategory.Conversations,
      title: window.i18n('conversationsSettingsTitle'),
    },
    {
      id: SessionSettingCategory.MessageRequests,
      title: window.i18n('openMessageRequestInbox'),
    },
    {
      id: SessionSettingCategory.Appearance,
      title: window.i18n('appearanceSettingsTitle'),
    },
    {
      id: SessionSettingCategory.Permissions,
      title: window.i18n('permissionsSettingsTitle'),
    },
    {
      id: SessionSettingCategory.Help,
      title: window.i18n('helpSettingsTitle'),
    },
    {
      id: SessionSettingCategory.RecoveryPhrase,
      title: window.i18n('recoveryPhrase'),
    },
    {
      id: SessionSettingCategory.ClearData,
      title: window.i18n('clearDataSettingsTitle'),
    },
  ];
};

const LeftPaneSettingsCategoryRow = (props: {
  item: { id: SessionSettingCategory; title: string };
}) => {
  const { item } = props;
  const { id, title } = item;
  const dispatch = useDispatch();
  const focusedSettingsSection = useSelector(getFocusedSettingsSection);

  const dataTestId = `${title.toLowerCase().replace(' ', '-')}-settings-menu-item`;

  const isClearData = id === SessionSettingCategory.ClearData;

  return (
    <StyledSettingsListItem
      data-testid={dataTestId}
      key={id}
      active={id === focusedSettingsSection}
      role="link"
      onClick={() => {
        switch (id) {
          case SessionSettingCategory.MessageRequests:
            dispatch(showLeftPaneSection(SectionType.Message));
            dispatch(setOverlayMode('message-requests'));
            dispatch(resetConversationExternal());
            break;
          case SessionSettingCategory.RecoveryPhrase:
            dispatch(recoveryPhraseModal({}));
            break;
          case SessionSettingCategory.ClearData:
            dispatch(updateDeleteAccountModal({}));
            break;
          default:
            dispatch(showSettingsSection(id));
        }
      }}
    >
      <StyledSettingsSectionTitle
        style={{ color: isClearData ? 'var(--color-destructive)' : 'unset' }}
      >
        {title}
      </StyledSettingsSectionTitle>

      {id === focusedSettingsSection && (
        <SessionIcon iconSize="medium" iconType="chevron" iconRotation={270} />
      )}
    </StyledSettingsListItem>
  );
};

const LeftPaneSettingsCategories = () => {
  const categories = getCategories();

  return (
    <>
      {categories.map(item => {
        return <LeftPaneSettingsCategoryRow key={item.id} item={item} />;
      })}
    </>
  );
};
const StyledContentSection = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow-y: auto;
`;

const StyledSettingsSectionTitle = styled.strong`
  font-family: var(--font-font-accent);
  font-size: var(--font-size-md);
`;

const StyledSettingsListItem = styled.div<{ active: boolean }>`
  background: ${props => (props.active ? 'var(--color-conversation-item-selected)' : 'none')};
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  height: 74px;
  line-height: 1.4;
  padding: 0px var(--margins-md);
  flex-shrink: 0;
  cursor: pointer;
  transition: var(--default-duration) !important;

  :hover {
    background: var(--color-clickable-hovered);
  }
`;

export const LeftPaneSettingSection = () => {
  return (
    <StyledContentSection>
      <LeftPaneSectionHeader />
      <StyledContentSection>
        <LeftPaneSettingsCategories />
      </StyledContentSection>
    </StyledContentSection>
  );
};
