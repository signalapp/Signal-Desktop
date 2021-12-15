import React from 'react';
import { icons, SessionIconSize, SessionIconType } from '../icon';
import styled, { css, keyframes } from 'styled-components';

export type SessionIconProps = {
  iconType: SessionIconType;
  iconSize: SessionIconSize | number;
  iconColor?: string;
  iconRotation?: number;
  iconPadding?: string;
  rotateDuration?: number;
  glowDuration?: number;
  borderRadius?: string;
  glowStartDelay?: number;
  noScale?: boolean;
  backgroundColor?: string;
};

const getIconDimensionFromIconSize = (iconSize: SessionIconSize | number) => {
  if (typeof iconSize === 'number') {
    return iconSize;
  } else {
    switch (iconSize) {
      case 'tiny':
        return 12;
      case 'small':
        return 15;
      case 'medium':
        return 20;
      case 'large':
        return 25;
      case 'huge':
        return 30;
      case 'huge2':
        return 40;
      case 'max':
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
  borderRadius?: string;
  iconPadding?: string;
  glowDuration?: number;
  glowStartDelay?: number;
  noScale?: boolean;
  iconColor?: string;
  backgroundColor?: string;
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
  //increase shadow intensity by 3
  const dropShadow = `drop-shadow(0px 0px 6px ${color});`;

  // creating keyframe for sequential animations
  let kf = '';
  const durationWithLoop = glowDuration + 1;
  for (let i = 0; i <= durationWithLoop; i++) {
    const percent = (100 / durationWithLoop) * i;

    if (i === glowStartDelay + 1) {
      kf += `${percent}% {
        filter: ${dropShadow}
        transform: scale(1.1);
      }`;
    } else {
      kf += `${percent}% {
        filter: none;
        transform: scale(0.9);
      }`;
    }
  }
  return keyframes`${kf}`;
};

const animation = (props: {
  rotateDuration?: number;
  glowDuration?: number;
  glowStartDelay?: number;
  iconColor?: string;
  noScale?: boolean;
}) => {
  if (props.rotateDuration) {
    return css`
      ${rotate} ${props.rotateDuration}s infinite linear;
    `;
  }
  if (props.noScale) {
    return css``;
  }

  if (props.glowDuration !== undefined && props.glowStartDelay !== undefined && props.iconColor) {
    return css`
      ${glow(
        props.iconColor,
        props.glowDuration,
        props.glowStartDelay
      )} ${props.glowDuration}s ease infinite;
    `;
  }

  return;
};

//tslint:disable no-unnecessary-callback-wrapper
const Svg = React.memo(styled.svg<StyledSvgProps>`
  width: ${props => props.width};
  transform: ${props => `rotate(${props.iconRotation}deg)`};
  animation: ${props => animation(props)};
  border-radius: ${props => props.borderRadius};
  background-color: ${props => (props.backgroundColor ? props.backgroundColor : '')};
  border-radius: ${props => (props.borderRadius ? props.borderRadius : '')};
  filter: ${props => (props.noScale ? `drop-shadow(0px 0px 4px ${props.iconColor})` : '')};
  padding: ${props => (props.iconPadding ? props.iconPadding : '')};
`);
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
  noScale?: boolean;
  borderRadius?: string;
  backgroundColor?: string;
  iconPadding?: string;
}) => {
  const colorSvg = props.iconColor;
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
    noScale: props.noScale,
    backgroundColor: props.backgroundColor,
    borderRadius: props.borderRadius,
    iconPadding: props.iconPadding,
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
    rotateDuration,
    glowDuration,
    borderRadius,
    glowStartDelay,
    noScale,
    backgroundColor,
    iconPadding,
  } = props;
  let { iconSize, iconRotation } = props;
  iconSize = iconSize || 'medium';
  iconRotation = iconRotation || 0;

  const iconDimensions = getIconDimensionFromIconSize(iconSize);
  const iconDef = icons[iconType];
  const ratio = iconDef?.ratio || 1;

  return (
    <SessionSvg
      viewBox={iconDef.viewBox}
      path={iconDef.path}
      width={iconDimensions * ratio}
      height={iconDimensions}
      rotateDuration={rotateDuration}
      glowDuration={glowDuration}
      glowStartDelay={glowStartDelay}
      noScale={noScale}
      borderRadius={borderRadius}
      iconRotation={iconRotation}
      iconColor={iconColor}
      backgroundColor={backgroundColor}
      iconPadding={iconPadding}
    />
  );
};
