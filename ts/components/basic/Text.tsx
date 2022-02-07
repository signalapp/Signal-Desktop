import React from 'react';
import styled from 'styled-components';

type TextProps = {
  text: string;
  subtle?: boolean;
  maxWidth?: string;
  padding?: string;
  textAlign?: 'center';
  ellipsisOverflow?: boolean;
};

const StyledDefaultText = styled.div<TextProps>`
  transition: var(--default-duration);
  max-width: ${props => (props.maxWidth ? props.maxWidth : '')};
  padding: ${props => (props.padding ? props.padding : '')};
  text-align: ${props => (props.textAlign ? props.textAlign : '')};
  font-family: var(--font-default);
  color: ${props => (props.subtle ? 'var(--color-text-subtle)' : 'var(--color-text)')};
  white-space: ${props => (props.ellipsisOverflow ? 'nowrap' : null)};
  overflow: ${props => (props.ellipsisOverflow ? 'hidden' : null)};
  text-overflow: ${props => (props.ellipsisOverflow ? 'ellipsis' : null)};
`;

export const Text = (props: TextProps) => {
  return <StyledDefaultText {...props}>{props.text}</StyledDefaultText>;
};

type SpacerProps = {
  size: 'lg' | 'md' | 'sm' | 'xs';
};

const SpacerStyled = styled.div<SpacerProps>`
  height: ${props =>
    props.size === 'lg'
      ? 'var(--margins-lg)'
      : props.size === 'md'
      ? 'var(--margins-md)'
      : props.size === 'sm'
      ? 'var(--margins-sm)'
      : 'var(--margins-xs)'};

  width: ${props =>
    props.size === 'lg'
      ? 'var(--margins-lg)'
      : props.size === 'md'
      ? 'var(--margins-md)'
      : props.size === 'sm'
      ? 'var(--margins-sm)'
      : 'var(--margins-xs)'};
`;

const Spacer = (props: SpacerProps) => {
  return <SpacerStyled {...props} />;
};

export const SpacerLG = () => {
  return <Spacer size="lg" />;
};

export const SpacerMD = () => {
  return <Spacer size="md" />;
};
export const SpacerSM = () => {
  return <Spacer size="sm" />;
};

export const SpacerXS = () => {
  return <Spacer size="xs" />;
};

type H3Props = {
  text: string;
};

const StyledH3 = styled.div<H3Props>`
  transition: var(--default-duration);
  font-family: var(--font-default);
  font-size: var(--font-size-md);
  font-weight: 700;
`;

export const H3 = (props: H3Props) => <StyledH3 {...props}>{props.text}</StyledH3>;
