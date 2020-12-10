import React, { useContext } from 'react';

import { SessionIcon, SessionIconSize, SessionIconType } from './icon/';
import { Flex } from './Flex';
import styled, { ThemeContext } from 'styled-components';

export enum SessionToastType {
  Info = 'info',
  Success = 'success',
  Warning = 'warning',
  Error = 'error',
}

type Props = {
  title: string;
  id?: string;
  type?: SessionToastType;
  icon?: SessionIconType;
  description?: string;
  closeToast?: any;
};

const TitleDiv = styled.div`
  font-size: ${props => props.theme.common.fonts.md};
  line-height: ${props => props.theme.common.fonts.md};
  font-family: ${props => props.theme.common.fonts.sessionFontDefault};
  color: ${props => props.theme.colors.textColor};
  text-overflow: ellipsis;
`;

const DescriptionDiv = styled.div`
  font-size: ${props => props.theme.common.fonts.sm};
  color: ${props => props.theme.colors.textColorSubtle};
  text-overflow: ellipsis;
  font-family: ${props => props.theme.common.fonts.sessionFontDefault};
  padding-bottom: ${props => props.theme.common.fonts.xs};
  padding-top: ${props => props.theme.common.fonts.xs};
`;

const IconDiv = styled.div`
  flex-shrink: 0;
  padding-inline-end: ${props => props.theme.common.margins.xs};
`;

export const SessionToast = (props: Props) => {
  const { title, description, type, icon } = props;

  const theme = useContext(ThemeContext);

  const toastDesc = description ? description : '';
  const toastIconSize = toastDesc
    ? SessionIconSize.Huge
    : SessionIconSize.Medium;

  // Set a custom icon or allow the theme to define the icon
  let toastIcon = icon || undefined;
  if (!toastIcon) {
    switch (type) {
      case SessionToastType.Info:
        toastIcon = SessionIconType.Info;
        break;
      case SessionToastType.Success:
        toastIcon = SessionIconType.Check;
        break;
      case SessionToastType.Error:
        toastIcon = SessionIconType.Error;
        break;
      case SessionToastType.Warning:
        toastIcon = SessionIconType.Warning;
        break;
      default:
        toastIcon = SessionIconType.Info;
    }
  }

  return (
    <Flex container={true} alignItems="center">
      <IconDiv>
        <SessionIcon
          iconType={toastIcon}
          iconSize={toastIconSize}
          theme={theme}
        />
      </IconDiv>
      <Flex
        container={true}
        justifyContent="flex-start"
        flexDirection="column"
        className="session-toast"
      >
        <TitleDiv>{title}</TitleDiv>
        {toastDesc && <DescriptionDiv>{toastDesc}</DescriptionDiv>}
      </Flex>
    </Flex>
  );
};
