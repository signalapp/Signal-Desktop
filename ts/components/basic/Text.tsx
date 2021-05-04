import React from 'react';
import styled from 'styled-components';

type TextProps = {
  text: string;
  subtle?: boolean;
  opposite?: boolean;
};

const StyledDefaultText = styled.div<TextProps>`
  transition: ${props => props.theme.common.animations.defaultDuration};
  font-family: ${props => props.theme.common.fonts.sessionFontDefault};
  color: ${props =>
    props.opposite
      ? props.theme.colors.textColorOpposite
      : props.subtle
      ? props.theme.colors.textColorSubtle
      : props.theme.colors.textColor};
`;

export const Text = (props: TextProps) => {
  return <StyledDefaultText {...props}>{props.text}</StyledDefaultText>;
};

type H3Props = {
  text: string;
  opposite?: boolean;
};

const StyledH3 = styled.div<H3Props>`
  transition: ${props => props.theme.common.animations.defaultDuration};
  font-family: ${props => props.theme.common.fonts.sessionFontDefault};
  color: ${props =>
    props.opposite ? props.theme.colors.textColorOpposite : props.theme.colors.textColor};
  font-size: ${props => props.theme.common.fonts.md};
  font-weight: 700;
`;

export const H3 = (props: H3Props) => <StyledH3 {...props}>{props.text}</StyledH3>;
