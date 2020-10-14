import styled, { css } from 'styled-components';

export interface FlexProps {
  children?: any;
  className?: string;
  container?: boolean;
  /****** Container Props ********/
  flexDirection?: 'row' | 'column';
  justifyContent?:
    | 'flex-start'
    | 'flex-end'
    | 'center'
    | 'space-between'
    | 'space-around'
    | 'initial'
    | 'inherit';
  flexWrap?: 'wrap' | 'nowrap' | 'wrap-reverse';
  alignItems?:
    | 'stretch'
    | 'center'
    | 'flex-start'
    | 'flex-end'
    | 'baseline'
    | 'initial'
    | 'inherit';
  /****** Child Props ********/
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: number;
  flex?: string;
  /****** Common Layout Props ********/
  padding?: string;
  margin?: string;
  width?: string;
  height?: string;
  maxWidth?: string;
  maxHeight?: string;
}

export const Flex = styled.div<FlexProps>`
  ${props =>
    (props.container &&
      css`
        display: flex;
      `) ||
    css`
      display: block;
    `};
  ${props =>
    props.justifyContent &&
    css`
      justifycontent: ${props.justifyContent || 'flex-start'};
    `};
  ${props =>
    props.flexDirection &&
    css`
      flexdirection: ${props.flexDirection || 'row'};
    `};
  ${props =>
    props.flexGrow &&
    css`
      flexgrow: ${props.flexGrow || '0'};
    `};
  ${props =>
    props.flexBasis &&
    css`
      flexbasis: ${props.flexBasis || 'auto'};
    `};
  ${props =>
    props.flexShrink &&
    css`
      flexshrink: ${props.flexShrink || '1'};
    `};
  ${props =>
    props.flexWrap &&
    css`
      flexwrap: ${props.flexWrap || 'nowrap'};
    `};
  ${props =>
    props.flex &&
    css`
      flex: ${props.flex || '0 1 auto'};
    `};
  ${props =>
    props.alignItems &&
    css`
      alignitems: ${props.alignItems || 'stretch'};
    `};
  ${props =>
    props.margin &&
    css`
      margin: ${props.margin || '0'};
    `};
  ${props =>
    props.padding &&
    css`
      padding: ${props.padding || '0'};
    `};
  ${props =>
    props.width &&
    css`
      width: ${props.width || 'auto'};
    `};
  ${props =>
    props.height &&
    css`
      height: ${props.height || 'auto'};
    `};
  ${props =>
    props.maxWidth &&
    css`
      maxwidth: ${props.maxWidth || 'none'};
    `};
`;
