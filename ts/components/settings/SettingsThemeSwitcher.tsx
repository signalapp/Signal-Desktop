import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import { switchThemeTo } from '../../session/utils/Theme';
import {
  darkColorReceivedMessageBg,
  darkColorSentMessageBg,
  getPrimaryColors,
  lightColorReceivedMessageBg,
  lightColorSentMessageBg,
  OceanBlueDark,
  OceanBlueLight,
  PrimaryColorIds,
} from '../../state/ducks/SessionTheme';
import { ThemeStateType } from '../../state/ducks/theme';
import { getTheme } from '../../state/selectors/theme';
import { SessionRadio, SessionRadioPrimaryColors } from '../basic/SessionRadio';
import { SpacerLG, SpacerMD } from '../basic/Text';
import { StyledDescriptionSettingsItem, StyledTitleSettingsItem } from './SessionSettingListItem';

// tslint:disable: use-simple-attributes

const StyledSwitcherContainer = styled.div`
  font-size: var(--font-size-md);
  padding: var(--margins-lg);
  background: var(--color-cell-background);
`;

const ThemeContainer = styled.button`
  background: var(--color-conversation-list);
  border: 1px solid var(--color-clickable-hovered);
  border-radius: 8px;
  padding: var(--margins-sm);
  display: flex;
  align-items: center;

  width: 285px;
  height: 90px;

  transition: var(--default-duration);

  :hover {
    background: var(--color-clickable-hovered);
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
  receivedBg: string;
  sentBg: string;
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
        fill={props.style.receivedBg}
        d="M8.7 27.9c0-3.2 2.6-5.7 5.7-5.7h30.4c3.2 0 5.7 2.6 5.7 5.7 0 3.2-2.6 5.7-5.7 5.7H14.4c-3.1.1-5.7-2.5-5.7-5.7z"
      />
      <path
        fill={props.style.sentBg}
        d="M32.6 42.2c0-3.2 2.6-5.7 5.7-5.7h27c3.2 0 5.7 2.6 5.7 5.7 0 3.2-2.6 5.7-5.7 5.7h-27c-3.1 0-5.7-2.5-5.7-5.7z"
      />
    </StyledPreview>
  );
};

const Themes = () => {
  const themes: Array<ThemeType> = [
    {
      id: 'dark',
      title: window.i18n('classicDarkThemeTitle'),
      style: {
        background: '#000000',
        border: '#414141',
        receivedBg: darkColorReceivedMessageBg,
        sentBg: darkColorSentMessageBg,
      },
    },
    {
      id: 'light',
      title: window.i18n('classicLightThemeTitle'),
      style: {
        background: '#ffffff',
        border: '#414141',
        receivedBg: lightColorReceivedMessageBg,
        sentBg: lightColorSentMessageBg,
      },
    },
    {
      id: 'ocean-dark',
      title: window.i18n('oceanDarkThemeTitle'),
      style: {
        background: OceanBlueDark.background,
        border: OceanBlueDark.border,
        receivedBg: OceanBlueDark.received,
        sentBg: OceanBlueDark.sent,
      },
    },
    {
      id: 'ocean-light',
      title: window.i18n('oceanLightThemeTitle'),
      style: {
        background: OceanBlueLight.background,
        border: OceanBlueLight.border,
        receivedBg: OceanBlueLight.received,
        sentBg: OceanBlueLight.sent,
      },
    },
  ];

  const selectedTheme = useSelector(getTheme);
  const dispatch = useDispatch();

  return (
    <>
      {themes.map(theme => {
        function onSelectTheme() {
          void switchThemeTo(theme.id, dispatch);
        }
        return (
          <ThemeContainer key={theme.id} onClick={onSelectTheme}>
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
        );
      })}
    </>
  );
};

export const SettingsThemeSwitcher = () => {
  //FIXME store that value somewhere in the theme object
  const [selectedAccent, setSelectedAccent] = useState<PrimaryColorIds | undefined>(undefined);

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
              active={item.id === selectedAccent}
              value={item.id}
              inputName="primary-colors"
              ariaLabel={item.ariaLabel}
              color={item.color}
              onClick={() => {
                setSelectedAccent(item.id);
              }}
            />
          );
        })}
      </ThemesContainer>
    </StyledSwitcherContainer>
  );
};
