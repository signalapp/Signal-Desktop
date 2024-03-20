import React, { forwardRef } from 'react';
import classNames from 'classnames';
import styled from 'styled-components';
import { useSelector } from 'react-redux';
import Picker from '@emoji-mart/react';

import { getTheme, isDarkTheme } from '../../state/selectors/theme';
import {
  COLORS,
  ColorsType,
  PrimaryColorStateType,
  THEMES,
  ThemeStateType,
  // eslint-disable-next-line import/extensions
} from '../../themes/constants/colors.js';
import { hexColorToRGB } from '../../util/hexColorToRGB';
import { getPrimaryColor } from '../../state/selectors/primaryColor';
import { i18nEmojiData } from '../../util/emoji';
import { FixedBaseEmoji } from '../../types/Reaction';

export const StyledEmojiPanel = styled.div<{
  isModal: boolean;
  primaryColor: PrimaryColorStateType;
  theme: ThemeStateType;
  panelBackgroundRGB: string;
  panelTextRGB: string;
}>`
  padding: var(--margins-lg);
  z-index: 5;
  opacity: 0;
  visibility: hidden;
  // this disables the slide-in animation when showing the emoji picker from a right click on a message
  /* transition: var(--default-duration); */

  button:focus {
    outline: none;
  }

  &.show {
    opacity: 1;
    visibility: visible;
  }

  em-emoji-picker {
    ${props => props.panelBackgroundRGB && `background-color: rgb(${props.panelBackgroundRGB})`};
    border: 1px solid var(--border-color);
    padding-bottom: var(--margins-sm);
    --font-family: var(--font-default);
    --font-size: var(--font-size-sm);
    --shadow: none;
    --border-radius: 8px;
    --color-border: var(--border-color);
    --color-border-over: var(--border-color);
    --background-rgb: ${props => props.panelBackgroundRGB};
    --rgb-background: ${props => props.panelBackgroundRGB};
    --rgb-color: ${props => props.panelTextRGB};
    --rgb-input: ${props => props.panelBackgroundRGB};
    --rgb-accent: ${props =>
      hexColorToRGB(
        props.primaryColor
          ? COLORS.PRIMARY[`${props.primaryColor.toUpperCase() as keyof ColorsType['PRIMARY']}`]
          : COLORS.PRIMARY.GREEN
      )};

    ${props =>
      !props.isModal &&
      `
      &:after {
        content: '';
        position: absolute;
        top: calc(100% - 40px);
        left: calc(100% - 106px);
        width: 22px;
        height: 22px;
        transform: rotate(45deg);
        border-radius: 3px;
        transform: scaleY(1.4) rotate(45deg);
        border: 0.7px solid var(--border-color);
        clip-path: polygon(100% 100%, 7.2px 100%, 100% 7.2px);
        ${props.panelBackgroundRGB && `background-color: rgb(${props.panelBackgroundRGB})`};

        [dir='rtl'] & {
          left: 75px;
        }
      }
    `};
  }
`;

type Props = {
  onEmojiClicked: (emoji: FixedBaseEmoji) => void;
  show: boolean;
  isModal?: boolean;
  // NOTE Currently this doesn't work but we have a PR waiting to be merged to resolve this
  onKeyDown?: (event: any) => void;
};

const pickerProps = {
  title: '',
  showPreview: true,
  autoFocus: true,
  skinTonePosition: 'preview',
};

// eslint-disable-next-line react/display-name
export const SessionEmojiPanel = forwardRef<HTMLDivElement, Props>((props: Props, ref) => {
  const { onEmojiClicked, show, isModal = false, onKeyDown } = props;
  const primaryColor = useSelector(getPrimaryColor);
  const theme = useSelector(getTheme);
  const isDarkMode = useSelector(isDarkTheme);

  let panelBackgroundRGB = hexColorToRGB(THEMES.CLASSIC_DARK.COLOR1);
  let panelTextRGB = hexColorToRGB(THEMES.CLASSIC_DARK.COLOR6);

  switch (theme) {
    case 'ocean-dark':
      panelBackgroundRGB = hexColorToRGB(THEMES.OCEAN_DARK.COLOR1);

      panelTextRGB = hexColorToRGB(THEMES.OCEAN_DARK.COLOR7!);
      break;
    case 'ocean-light':
      panelBackgroundRGB = hexColorToRGB(THEMES.OCEAN_LIGHT.COLOR7!);
      panelTextRGB = hexColorToRGB(THEMES.OCEAN_LIGHT.COLOR1);
      break;
    case 'classic-light':
      panelBackgroundRGB = hexColorToRGB(THEMES.CLASSIC_LIGHT.COLOR6);
      panelTextRGB = hexColorToRGB(THEMES.CLASSIC_LIGHT.COLOR0);
      break;
    case 'classic-dark':
    default:
      panelBackgroundRGB = hexColorToRGB(THEMES.CLASSIC_DARK.COLOR1);
      panelTextRGB = hexColorToRGB(THEMES.CLASSIC_DARK.COLOR6);
  }

  return (
    <StyledEmojiPanel
      isModal={isModal}
      primaryColor={primaryColor}
      theme={theme}
      panelBackgroundRGB={panelBackgroundRGB}
      panelTextRGB={panelTextRGB}
      className={classNames(show && 'show')}
      ref={ref}
    >
      <Picker
        theme={isDarkMode ? 'dark' : 'light'}
        i18n={i18nEmojiData}
        onEmojiSelect={onEmojiClicked}
        onKeyDown={onKeyDown}
        {...pickerProps}
      />
    </StyledEmojiPanel>
  );
});
