import React from 'react';
import { icons, SessionIconSize, SessionIconType } from '../icon';
import styled, { css, DefaultTheme, keyframes, useTheme } from 'styled-components';
import _ from 'lodash';

export type SessionIconProps = {
  iconType: SessionIconType;
  iconSize: SessionIconSize | number;
  iconColor?: string;
  iconRotation?: number;
  rotateDuration?: number;
  glowDuration?: number;
  borderRadius?: number;
  glowStartDelay?: number;
  theme?: DefaultTheme;
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
  borderRadius?: number;
  glowDuration?: number;
  glowStartDelay?: number;
  iconColor?: string;
};

const rotate = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`;

/**
 * Creates a glow animation made for multiple element sequentially
 */
const glow = (color: string, glowDuration: number, glowStartDelay: number) => {
  const dropShadowType = `drop-shadow(0px 0px 4px ${color}) `;
  //increase shadow intensity by 3
  const dropShadow = `${dropShadowType.repeat(2)};`;

  // TODO: Decrease dropshadow for last frame
  // creating keyframe for sequential animations
  let kf = '';
  for (let i = 0; i <= glowDuration; i++) {
    // const percent = (100 / glowDuration) * i;
    const percent = (100 / glowDuration) * i;
    if (i === glowStartDelay) {
      kf += `${percent}% {
        filter: ${dropShadow}
        transform: scale(1.5);
      }`;
    } else {
      kf += `${percent}% {
        filter: none;
        transform: scale(0.8);
      }`;
    }
  }
  return keyframes`${kf}`;
};

const animation = (props: any) => {
  if (props.rotateDuration) {
    return css`
      ${rotate} ${props.rotateDuration}s infinite linear;
    `;
  } else if (props.glowDuration !== undefined && props.glowStartDelay !== undefined) {
    return css`
      ${glow(props.iconColor, props.glowDuration, props.glowStartDelay)} ${props.glowDuration}s ease-in infinite;
    `;
  } else {
    return;
  }
};

//tslint:disable no-unnecessary-callback-wrapper
const Svg = styled.svg<StyledSvgProps>`
  width: ${props => props.width};
  transform: ${props => `rotate(${props.iconRotation}deg)`};
  animation: ${props => animation(props)};
  border-radius: ${props => props.borderRadius};
`;
//tslint:enable no-unnecessary-callback-wrapper

const SessionSvg = (props: {
  viewBox: string;
  path: string | Array<string>;
  width: string | number;
  height: string | number;
  iconRotation: number;
  iconColor?: string;
  rotateDuration?: number;
  glowDuration?: number;
  glowStartDelay?: number;
  borderRadius?: number;
  theme: DefaultTheme;
}) => {
  const colorSvg = props.iconColor || props?.theme?.colors.textColor;
  const pathArray = props.path instanceof Array ? props.path : [props.path];
  const propsToPick = {
    width: props.width,
    height: props.height,
    rotateDuration: props.rotateDuration,
    iconRotation: props.iconRotation,
    viewBox: props.viewBox,
    glowDuration: props.glowDuration,
    glowStartDelay: props.glowStartDelay,
    iconColor: props.iconColor,
  };

  return (
    <Svg {...propsToPick}>
      {pathArray.map((path, index) => {
        return <path key={index} fill={colorSvg} d={path} />;
      })}
    </Svg>
  );
};

export const SessionIcon = (props: SessionIconProps) => {
  const {
    iconType,
    iconColor,
    theme,
    rotateDuration,
    glowDuration,
    borderRadius,
    glowStartDelay,
  } = props;
  let { iconSize, iconRotation } = props;
  iconSize = iconSize || SessionIconSize.Medium;
  iconRotation = iconRotation || 0;

  const themeToUse = theme || useTheme();

  const iconDimensions = getIconDimensionFromIconSize(iconSize);
  const iconDef = icons[iconType];
  const ratio = iconDef?.ratio || 1;
  if (!theme) {
    window?.log?.error('Missing theme props in SessionIcon');
  }

  return (
    <SessionSvg
      viewBox={iconDef.viewBox}
      path={iconDef.path}
      width={iconDimensions * ratio}
      height={iconDimensions}
      rotateDuration={rotateDuration}
      glowDuration={glowDuration}
      glowStartDelay={glowStartDelay}
      borderRadius={borderRadius}
      iconRotation={iconRotation}
      iconColor={iconColor}
      theme={themeToUse}
    />
  );
};
