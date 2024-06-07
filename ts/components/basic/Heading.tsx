import { ReactNode } from 'react';
import styled, { CSSProperties } from 'styled-components';

export type HeadingProps = {
  children: ReactNode;
  color?: string;
  style?: CSSProperties;
  /** center | start (left) | end (right) */
  alignText?: 'center' | 'start' | 'end';
  fontWeight?: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  padding?: string;
  margin?: string;
};

type StyledHeadingProps = HeadingProps & {
  // TODO add h5 to h9 once we update the typography from the design system
  size: 'h1' | 'h2' | 'h3' | 'h4';
};

const headingStyles = (props: StyledHeadingProps) => `
margin: ${props.margin ? props.margin : '0'};
padding: ${props.padding ? props.padding : '0'};
font-weight: ${props.fontWeight ? props.fontWeight : '700'};
${props.size ? `font-size: var(--font-size-${props.size});` : ''}
${props.color ? `color: ${props.color};` : ''}
${props.alignText ? `text-align: ${props.alignText};` : ''}
`;

const Heading = (headerProps: StyledHeadingProps) => {
  const StyledHeading = styled(headerProps.size)<StyledHeadingProps>`
    ${props => headingStyles(props)}
  `;

  return <StyledHeading {...headerProps}>{headerProps.children}</StyledHeading>;
};

/** --font-size-h1 30px */
export const H1 = (props: HeadingProps) => {
  return <Heading {...props} size="h1" />;
};

/** --font-size-h2 24px */
export const H2 = (props: HeadingProps) => {
  return <Heading {...props} size="h2" />;
};

/** --font-size-h3 20px */
export const H3 = (props: HeadingProps) => {
  return <Heading {...props} size="h3" />;
};

/** --font-size-h4 16px */
export const H4 = (props: HeadingProps) => {
  return <Heading {...props} size="h4" />;
};
