import React from 'react';

import { icons, SessionIconSize, SessionIconType } from '../icon';
import styled, { DefaultTheme } from 'styled-components';

export type SessionIconProps = {
  iconType: SessionIconType;
  iconSize: SessionIconSize | number;
  iconColor?: string;
  iconRotation?: number;
  theme: DefaultTheme;
};

const getIconDimensionFromIconSize = (iconSize: SessionIconSize | number) => {
  if (typeof iconSize === 'number') {
    return iconSize;
  } else {
    switch (iconSize) {
      case SessionIconSize.Small:
        return '15';
      case SessionIconSize.Medium:
        return '20';
      case SessionIconSize.Large:
        return '25';
      case SessionIconSize.Huge:
        return '30';
      case SessionIconSize.Max:
        return '80';
      default:
        return '20';
    }
  }
};

type StyledSvgProps = {
  width: string | number;
  height: string | number;
  iconRotation: number;
};

const Svg = styled.svg<StyledSvgProps>`
  width: ${props => props.width};
  height: ${props => props.height};
  transform: ${props => `rotate(${props.iconRotation}deg)`};
`;

const SessionSvg = (props: {
  viewBox: string;
  path: string;
  width: string | number;
  height: string | number;
  iconRotation: number;
  iconColor?: string;
  theme: DefaultTheme;
}) => {
  const colorSvg = props.iconColor || props?.theme?.colors.textColor || 'red';
  return (
    <Svg {...props}>
      <path fill={colorSvg} d={props.path} />
    </Svg>
  );
};

export const SessionIcon = (props: SessionIconProps) => {
  const { iconType, iconColor, theme } = props;
  let { iconSize, iconRotation } = props;
  iconSize = iconSize || SessionIconSize.Medium;
  // default to whatever the text color is near this svg
  iconRotation = iconRotation || 0;

  const iconDimensions = getIconDimensionFromIconSize(iconSize);
  const iconDef = icons[iconType];
  // const themeContext = useContext(ThemeContext);

  if (!theme) {
    debugger;
  }

  return (
    <SessionSvg
      viewBox={iconDef.viewBox}
      path={iconDef.path}
      width={iconDimensions}
      height={iconDimensions}
      iconRotation={iconRotation}
      iconColor={iconColor}
      theme={theme}
    />
  );
};
