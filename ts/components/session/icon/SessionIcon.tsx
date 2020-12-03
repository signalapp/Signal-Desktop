import React from 'react';

import { icons, SessionIconSize, SessionIconType } from '../icon';
import styled, { css, DefaultTheme, keyframes } from 'styled-components';

export type SessionIconProps = {
  iconType: SessionIconType;
  iconSize: SessionIconSize | number;
  iconColor?: string;
  iconRotation?: number;
  rotateDuration?: number;
  theme: DefaultTheme;
};

const getIconDimensionFromIconSize = (iconSize: SessionIconSize | number) => {
  if (typeof iconSize === 'number') {
    return iconSize;
  } else {
    switch (iconSize) {
      case SessionIconSize.Tiny:
        return 12;
      case SessionIconSize.Small:
        return 15;
      case SessionIconSize.Medium:
        return 20;
      case SessionIconSize.Large:
        return 25;
      case SessionIconSize.Huge:
        return 30;
      case SessionIconSize.Max:
        return 80;
      default:
        return 20;
    }
  }
};

type StyledSvgProps = {
  width: string | number;
  height: string | number;
  iconRotation: number;
  rotateDuration?: number;
};

const rotate = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`;

const animation = (props: any) => {
  if (props.rotateDuration) {
    return css`
      ${rotate} ${props.rotateDuration}s infinite linear;
    `;
  } else {
    return;
  }
};

//tslint:disable no-unnecessary-callback-wrapper
const Svg = styled.svg<StyledSvgProps>`
  width: ${props => props.width};
  animation: ${props => animation(props)};
  transform: ${props => `rotate(${props.iconRotation}deg)`};
`;
//tslint:enable no-unnecessary-callback-wrapper

const SessionSvg = (props: {
  viewBox: string;
  path: string;
  width: string | number;
  height: string | number;
  iconRotation: number;
  iconColor?: string;
  rotateDuration?: number;
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
  const { iconType, iconColor, theme, rotateDuration } = props;
  let { iconSize, iconRotation } = props;
  iconSize = iconSize || SessionIconSize.Medium;
  iconRotation = iconRotation || 0;

  const iconDimensions = getIconDimensionFromIconSize(iconSize);
  const iconDef = icons[iconType];
  const ratio = iconDef?.ratio || 1;
  if (!theme) {
    window.log.error('Missing theme props in SessionIcon');
  }

  return (
    <SessionSvg
      viewBox={iconDef.viewBox}
      path={iconDef.path}
      width={iconDimensions * ratio}
      height={iconDimensions}
      rotateDuration={rotateDuration}
      iconRotation={iconRotation}
      iconColor={iconColor}
      theme={theme}
    />
  );
};
