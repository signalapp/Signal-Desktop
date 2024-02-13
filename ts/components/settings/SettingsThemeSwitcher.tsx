import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import { getPrimaryColor } from '../../state/selectors/primaryColor';
import { getTheme } from '../../state/selectors/theme';
import {
  StyleSessionSwitcher,
  getPrimaryColors,
  getThemeColors,
} from '../../themes/constants/colors';
import { switchPrimaryColorTo } from '../../themes/switchPrimaryColor';
import { switchThemeTo } from '../../themes/switchTheme';
import { SessionRadio, SessionRadioPrimaryColors } from '../basic/SessionRadio';
import { SpacerLG, SpacerMD } from '../basic/Text';
import { StyledDescriptionSettingsItem, StyledTitleSettingsItem } from './SessionSettingListItem';

const StyledSwitcherContainer = styled.div`
  font-size: var(--font-size-md);
  padding: var(--margins-lg);
  margin-bottom: var(--margins-lg);

  background: var(--settings-tab-background-color);
  color: var(--settings-tab-text-color);
  border-top: 1px solid var(--border-color);
  border-bottom: 1px solid var(--border-color);
`;

const ThemeContainer = styled.button`
  background: var(--background-secondary-color);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: var(--margins-sm);
  display: flex;
  align-items: center;

  width: 285px;
  height: 90px;

  transition: var(--default-duration);

  :hover {
    background: var(--settings-tab-background-hover-color);
  }
`;

const ThemesContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: var(--margins-lg);
`;

const StyledPreview = styled.svg`
  max-height: 100%;
`;

const ThemePreview = (props: { style: StyleSessionSwitcher }) => {
  return (
    <StyledPreview xmlSpace="preserve" viewBox="0 0 80 72" fill={props.style.background}>
      <path
        stroke={props.style.border}
        d="M7.5.9h64.6c3.6 0 6.5 2.9 6.5 6.5v56.9c0 3.6-2.9 6.5-6.5 6.5H7.5c-3.6 0-6.5-2.9-6.5-6.5V7.4C1 3.9 3.9.9 7.5.9z"
      />
      <path
        fill={props.style.receivedBackground}
        d="M8.7 27.9c0-3.2 2.6-5.7 5.7-5.7h30.4c3.2 0 5.7 2.6 5.7 5.7 0 3.2-2.6 5.7-5.7 5.7H14.4c-3.1.1-5.7-2.5-5.7-5.7z"
      />
      <path
        fill={props.style.sentBackground}
        d="M32.6 42.2c0-3.2 2.6-5.7 5.7-5.7h27c3.2 0 5.7 2.6 5.7 5.7 0 3.2-2.6 5.7-5.7 5.7h-27c-3.1 0-5.7-2.5-5.7-5.7z"
      />
    </StyledPreview>
  );
};

const Themes = () => {
  const themes = getThemeColors();
  const selectedTheme = useSelector(getTheme);
  const dispatch = useDispatch();

  return (
    <>
      {themes.map(theme => (
        <ThemeContainer
          key={theme.id}
          onClick={() => {
            void switchThemeTo({
              theme: theme.id,
              mainWindow: true,
              dispatch,
            });
          }}
        >
          <ThemePreview style={theme.style} />
          <SpacerLG />

          <StyledTitleSettingsItem>{theme.title}</StyledTitleSettingsItem>
          <SessionRadio
            active={selectedTheme === theme.id}
            label={''}
            value={theme.id}
            inputName={'theme-switcher'}
            style={{ padding: '0 0 0 var(--margins-lg)' }}
          />
        </ThemeContainer>
      ))}
    </>
  );
};

export const SettingsThemeSwitcher = () => {
  const selectedPrimaryColor = useSelector(getPrimaryColor);
  const dispatch = useDispatch();

  return (
    <StyledSwitcherContainer>
      <StyledTitleSettingsItem>{window.i18n('themesSettingTitle')}</StyledTitleSettingsItem>
      <ThemesContainer>
        <Themes />
      </ThemesContainer>
      <SpacerMD />
      <StyledDescriptionSettingsItem>{window.i18n('primaryColor')}</StyledDescriptionSettingsItem>
      <SpacerMD />
      <ThemesContainer style={{ marginInlineStart: 'var(--margins-xs)' }}>
        {getPrimaryColors().map(item => {
          return (
            <SessionRadioPrimaryColors
              key={item.id}
              active={item.id === selectedPrimaryColor}
              value={item.id}
              inputName="primary-colors"
              ariaLabel={item.ariaLabel}
              color={item.color}
              onClick={() => {
                void switchPrimaryColorTo(item.id, dispatch);
              }}
            />
          );
        })}
      </ThemesContainer>
    </StyledSwitcherContainer>
  );
};
