import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import { switchThemeTo } from '../../session/utils/Theme';
import { getTheme } from '../../state/selectors/theme';
import { SessionRadio, SessionRadioPrimaryColors } from '../basic/SessionRadio';
import { SpacerLG, SpacerMD } from '../basic/Text';
import { StyledDescriptionSettingsItem, StyledTitleSettingsItem } from './SessionSettingListItem';
import { getPrimaryColors, THEMES, ThemeStateType } from '../../themes/colors';
import { switchPrimaryColor } from '../../themes/switchPrimaryColor';
import { getPrimaryColor } from '../../state/selectors/primaryColor';

// tslint:disable: use-simple-attributes

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

type ThemeType = {
  id: ThemeStateType;
  title: string;
  style: StyleSessionSwitcher;
};

type StyleSessionSwitcher = {
  background: string;
  border: string;
  receivedBackground: string;
  sentBackground: string;
};

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
  const themes: Array<ThemeType> = [
    {
      id: 'classic-dark',
      title: window.i18n('classicDarkThemeTitle'),
      style: {
        background: THEMES.CLASSIC_DARK.COLOR0,
        border: THEMES.CLASSIC_DARK.COLOR3,
        receivedBackground: THEMES.CLASSIC_DARK.COLOR2,
        sentBackground: THEMES.CLASSIC_DARK.PRIMARY,
      },
    },
    {
      id: 'classic-light',
      title: window.i18n('classicLightThemeTitle'),
      style: {
        background: THEMES.CLASSIC_LIGHT.COLOR6,
        border: THEMES.CLASSIC_LIGHT.COLOR3,
        receivedBackground: THEMES.CLASSIC_LIGHT.COLOR4,
        sentBackground: THEMES.CLASSIC_LIGHT.PRIMARY,
      },
    },
    {
      id: 'ocean-dark',
      title: window.i18n('oceanDarkThemeTitle'),
      style: {
        background: THEMES.OCEAN_DARK.COLOR2,
        border: THEMES.OCEAN_DARK.COLOR4,
        receivedBackground: THEMES.OCEAN_DARK.COLOR4,
        sentBackground: THEMES.OCEAN_DARK.PRIMARY,
      },
    },
    {
      id: 'ocean-light',
      title: window.i18n('oceanLightThemeTitle'),
      style: {
        background: THEMES.OCEAN_LIGHT.COLOR7!,
        border: THEMES.OCEAN_LIGHT.COLOR3,
        receivedBackground: THEMES.OCEAN_LIGHT.COLOR1,
        sentBackground: THEMES.OCEAN_LIGHT.PRIMARY,
      },
    },
  ];

  const selectedTheme = useSelector(getTheme);
  const dispatch = useDispatch();

  return (
    <>
      {themes.map(theme => (
        <ThemeContainer
          key={theme.id}
          onClick={() => {
            // TODO Change to switchTheme function
            void switchThemeTo(theme.id, dispatch);
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
                switchPrimaryColor(item.id, dispatch);
              }}
            />
          );
        })}
      </ThemesContainer>
    </StyledSwitcherContainer>
  );
};
