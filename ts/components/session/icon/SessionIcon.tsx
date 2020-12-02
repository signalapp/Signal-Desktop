import React from 'react';
import classNames from 'classnames';

import { icons, SessionIconSize, SessionIconType } from '../icon';
import styled from 'styled-components';

export type Props = {
  iconType: SessionIconType;
  iconSize: SessionIconSize | number;
  iconColor?: string;
  iconPadded?: boolean;
  iconRotation?: number;
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
  className: string;
  viewBox: string;
  path: string;
  width: string | number;
  height: string | number;
  iconRotation: number;
}) => (
  <Svg {...props}>
    <path fill="currentColor" d={props.path} />
  </Svg>
);

export const SessionIcon = (props: Props) => {
  const { iconType } = props;
  let { iconSize, iconColor, iconRotation, iconPadded } = props;
  iconSize = iconSize || SessionIconSize.Medium;
  iconColor = iconColor || '';
  iconRotation = iconRotation || 0;
  iconPadded = iconPadded || false;

  const iconDimensions = getIconDimensionFromIconSize(iconSize);
  const iconDef = icons[iconType];

  return (
    <SessionSvg
      className={classNames(
        'session-icon',
        iconType,
        iconPadded ? 'padded' : ''
      )}
      viewBox={iconDef.viewBox}
      path={iconDef.path}
      width={iconDimensions}
      height={iconDimensions}
      iconRotation={iconRotation}
    />
  );
};
