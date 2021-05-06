import styled from 'styled-components';

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
  display: ${props => (props.container ? 'flex' : 'block')};
  justify-content: ${props => props.justifyContent || 'flex-start'};
  flex-direction: ${props => props.flexDirection || 'row'};
  flex-grow: ${props => props.flexGrow || '0'};
  flex-basis: ${props => props.flexBasis || 'auto'};
  flex-shrink: ${props => props.flexShrink || '1'};
  flex-wrap: ${props => props.flexWrap || 'nowrap'};
  flex: ${props => props.flex || '0 1 auto'};
  align-items: ${props => props.alignItems || 'stretch'};
  margin: ${props => props.margin || '0'};
  padding: ${props => props.padding || '0'};
  width: ${props => props.width || 'auto'};
  height: ${props => props.height || 'auto'};
  max-width: ${props => props.maxWidth || 'none'};
`;
