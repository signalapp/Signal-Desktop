import React, { useContext } from 'react';

import { SessionIcon, SessionIconType } from './icon/';
import { Flex } from '../basic/Flex';
import styled, { ThemeContext } from 'styled-components';
import { noop } from 'lodash';

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
  onToastClick?: () => void;
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
  const toastIconSize = toastDesc ? 'huge' : 'medium';

  // Set a custom icon or allow the theme to define the icon
  let toastIcon = icon || undefined;
  if (!toastIcon) {
    switch (type) {
      case SessionToastType.Info:
        toastIcon = 'info';
        break;
      case SessionToastType.Success:
        toastIcon = 'check';
        break;
      case SessionToastType.Error:
        toastIcon = 'error';
        break;
      case SessionToastType.Warning:
        toastIcon = 'warning';
        break;
      default:
        toastIcon = 'info';
    }
  }

  return (
    // tslint:disable-next-line: use-simple-attributes
    <Flex container={true} alignItems="center" onClick={props?.onToastClick || noop}>
      <IconDiv>
        <SessionIcon iconType={toastIcon} iconSize={toastIconSize} theme={theme} />
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
