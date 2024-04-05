import React from 'react';
import styled, { CSSProperties } from 'styled-components';

type TextProps = {
  text: string;
  subtle?: boolean;
  maxWidth?: string;
  padding?: string;
  textAlign?: 'center';
  ellipsisOverflow?: boolean;
};

const StyledDefaultText = styled.div<Omit<TextProps, 'text'>>`
  transition: var(--default-duration);
  max-width: ${props => (props.maxWidth ? props.maxWidth : '')};
  padding: ${props => (props.padding ? props.padding : '')};
  text-align: ${props => (props.textAlign ? props.textAlign : '')};
  font-family: var(--font-default);
  color: ${props => (props.subtle ? 'var(--text-secondary-color)' : 'var(--text-primary-color)')};
  white-space: ${props => (props.ellipsisOverflow ? 'nowrap' : null)};
  overflow: ${props => (props.ellipsisOverflow ? 'hidden' : null)};
  text-overflow: ${props => (props.ellipsisOverflow ? 'ellipsis' : null)};
`;

export const Text = (props: TextProps) => {
  return <StyledDefaultText {...props}>{props.text}</StyledDefaultText>;
};

export const TextWithChildren = (
  props: Omit<TextProps, 'text'> & { children: React.ReactNode }
) => {
  return <StyledDefaultText {...props}>{props.children}</StyledDefaultText>;
};

type SpacerProps = {
  size: 'xl' | 'lg' | 'md' | 'sm' | 'xs';
  style?: CSSProperties;
};

const SpacerStyled = styled.div<SpacerProps>`
  height: ${props =>
    props.size === 'xl'
      ? 'var(--margins-xl)'
      : props.size === 'lg'
        ? 'var(--margins-lg)'
        : props.size === 'md'
          ? 'var(--margins-md)'
          : props.size === 'sm'
            ? 'var(--margins-sm)'
            : 'var(--margins-xs)'};

  width: ${props =>
    props.size === 'xl'
      ? 'var(--margins-xl)'
      : props.size === 'lg'
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

export const SpacerXL = (props: { style?: CSSProperties }) => {
  return <Spacer size="xl" style={props.style} />;
};

export const SpacerLG = (props: { style?: CSSProperties }) => {
  return <Spacer size="lg" style={props.style} />;
};

export const SpacerMD = (props: { style?: CSSProperties }) => {
  return <Spacer size="md" style={props.style} />;
};
export const SpacerSM = (props: { style?: CSSProperties }) => {
  return <Spacer size="sm" style={props.style} />;
};

export const SpacerXS = (props: { style?: CSSProperties }) => {
  return <Spacer size="xs" style={props.style} />;
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
