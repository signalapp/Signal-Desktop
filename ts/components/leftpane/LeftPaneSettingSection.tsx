import { useDispatch, useSelector } from 'react-redux';
import styled, { CSSProperties } from 'styled-components';

import { resetConversationExternal } from '../../state/ducks/conversations';
import { updateDeleteAccountModal } from '../../state/ducks/modalDialog';
import {
  SectionType,
  setLeftOverlayMode,
  showLeftPaneSection,
  showSettingsSection,
} from '../../state/ducks/section';
import { getFocusedSettingsSection } from '../../state/selectors/section';
import type { SessionSettingCategory } from '../../types/ReduxTypes';
import { Flex } from '../basic/Flex';
import { SessionIcon, SessionIconSize, SessionIconType } from '../icon';
import { LeftPaneSectionHeader } from './LeftPaneSectionHeader';

const StyledSettingsSectionTitle = styled.span`
  font-size: var(--font-size-md);
  font-weight: 500;
  flex-grow: 1;
`;

const StyledSettingsListItem = styled(Flex)<{ active: boolean }>`
  background-color: ${props =>
    props.active
      ? 'var(--settings-tab-background-selected-color)'
      : 'var(--settings-tab-background-color)'};
  color: var(--settings-tab-text-color);
  height: 74px;
  line-height: 1;
  cursor: pointer;
  transition: var(--default-duration) !important;

  :hover {
    background: var(--settings-tab-background-hover-color);
  }
`;

const StyledIconContainer = styled.div`
  width: 34px;
`;

type Categories = {
  id: SessionSettingCategory;
  title: string;
  icon: {
    type: SessionIconType;
    size?: SessionIconSize | number;
    color?: string;
    style?: CSSProperties;
  };
};

const getCategories = (): Array<Categories> => {
  return [
    {
      id: 'privacy' as const,
      title: window.i18n('privacySettingsTitle'),
      icon: { type: 'padlock', style: { marginTop: '-5px' } },
    },
    {
      id: 'notifications' as const,
      title: window.i18n('notificationsSettingsTitle'),
      icon: { type: 'speaker' },
    },
    {
      id: 'conversations' as const,
      title: window.i18n('conversationsSettingsTitle'),
      icon: { type: 'chatBubble' },
    },
    {
      id: 'messageRequests' as const,
      title: window.i18n('openMessageRequestInbox'),
      icon: { type: 'messageRequest' },
    },
    {
      id: 'appearance' as const,
      title: window.i18n('appearanceSettingsTitle'),
      icon: { type: 'paintbrush' },
    },
    {
      id: 'permissions',
      title: window.i18n('permissionsSettingsTitle'),
      icon: { type: 'checkCircle', size: 19 },
    },
    {
      id: 'help' as const,
      title: window.i18n('helpSettingsTitle'),
      icon: { type: 'question', size: 19 },
    },
    {
      id: 'recoveryPassword' as const,
      title: window.i18n('sessionRecoveryPassword'),
      icon: { type: 'recoveryPasswordFill', size: 'medium' },
    },
    {
      id: 'clearData' as const,
      title: window.i18n('clearDataSettingsTitle'),
      icon: { type: 'delete', size: 19, color: 'var(--danger-color)' },
    },
  ];
};

const LeftPaneSettingsCategoryRow = (props: { item: Categories }) => {
  const { item } = props;
  const { id, title, icon } = item;
  const dispatch = useDispatch();
  const focusedSettingsSection = useSelector(getFocusedSettingsSection);

  const dataTestId = `${title.toLowerCase().replace(' ', '-')}-settings-menu-item`;

  const isClearData = id === 'clearData';

  return (
    <StyledSettingsListItem
      key={id}
      active={id === focusedSettingsSection}
      role="link"
      container={true}
      flexDirection={'row'}
      justifyContent={'flex-start'}
      alignItems={'center'}
      flexShrink={0}
      padding={'0px var(--margins-md) 0 var(--margins-sm)'}
      onClick={() => {
        switch (id) {
          case 'messageRequests':
            dispatch(showLeftPaneSection(SectionType.Message));
            dispatch(setLeftOverlayMode('message-requests'));
            dispatch(resetConversationExternal());
            break;
          case 'clearData':
            dispatch(updateDeleteAccountModal({}));
            break;
          default:
            dispatch(showSettingsSection(id));
        }
      }}
      data-testid={dataTestId}
    >
      <StyledIconContainer>
        <SessionIcon
          iconType={icon.type}
          iconSize={icon.size || 23}
          iconColor={icon.color || 'var(--text-primary-color)'}
          style={icon.style}
        />
      </StyledIconContainer>
      <StyledSettingsSectionTitle style={{ color: isClearData ? 'var(--danger-color)' : 'unset' }}>
        {title}
      </StyledSettingsSectionTitle>

      {id === focusedSettingsSection && (
        <SessionIcon
          iconSize={'medium'}
          iconType="chevron"
          iconColor={'var(--text-primary-color)'}
          iconRotation={270}
        />
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
