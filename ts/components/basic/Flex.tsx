import { HTMLMotionProps, motion } from 'framer-motion';
import styled from 'styled-components';
import { HTMLDirection } from '../../util/i18n';

export interface FlexProps {
  children?: any;
  className?: string;
  container?: boolean;
  dataTestId?: string;
  // Container Props
  flexDirection?: 'row' | 'row-reverse' | 'column' | 'column-reverse';
  justifyContent?:
    | 'flex-start'
    | 'flex-end'
    | 'center'
    | 'space-between'
    | 'space-around'
    | 'initial'
    | 'inherit';
  flexWrap?: 'wrap' | 'nowrap' | 'wrap-reverse';
  flexGap?: string;
  alignItems?:
    | 'stretch'
    | 'center'
    | 'flex-start'
    | 'flex-end'
    | 'baseline'
    | 'initial'
    | 'inherit';
  // Child Props
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: number;
  // Common Layout Props
  padding?: string;
  margin?: string;
  width?: string;
  height?: string;
  maxWidth?: string;
  minWidth?: string;
  maxHeight?: string;
  // RTL support
  dir?: HTMLDirection;
}

export const Flex = styled.div<FlexProps>`
  display: ${props => (props.container ? 'flex' : 'block')};
  justify-content: ${props => props.justifyContent || 'flex-start'};
  flex-direction: ${props => props.flexDirection || 'row'};
  flex-grow: ${props => (props.flexGrow !== undefined ? props.flexGrow : '0')};
  flex-basis: ${props => (props.flexBasis !== undefined ? props.flexBasis : 'auto')};
  flex-shrink: ${props => (props.flexShrink !== undefined ? props.flexShrink : '1')};
  flex-wrap: ${props => (props.flexWrap !== undefined ? props.flexWrap : 'nowrap')};
  gap: ${props => (props.flexGap !== undefined ? props.flexGap : undefined)};
  align-items: ${props => props.alignItems || 'stretch'};
  margin: ${props => props.margin || '0'};
  padding: ${props => props.padding || '0'};
  width: ${props => props.width || 'auto'};
  height: ${props => props.height || 'auto'};
  max-width: ${props => props.maxWidth || 'none'};
  min-width: ${props => props.minWidth || 'none'};
  direction: ${props => props.dir || undefined};
`;

export const AnimatedFlex = styled(motion.div)<HTMLMotionProps<'div'> & FlexProps>`
  display: ${props => (props.container ? 'flex' : 'block')};
  justify-content: ${props => props.justifyContent || 'flex-start'};
  flex-direction: ${props => props.flexDirection || 'row'};
  flex-grow: ${props => (props.flexGrow !== undefined ? props.flexGrow : '0')};
  flex-basis: ${props => (props.flexBasis !== undefined ? props.flexBasis : 'auto')};
  flex-shrink: ${props => (props.flexShrink !== undefined ? props.flexShrink : '1')};
  flex-wrap: ${props => (props.flexWrap !== undefined ? props.flexWrap : 'nowrap')};
  gap: ${props => (props.flexGap !== undefined ? props.flexGap : undefined)};
  align-items: ${props => props.alignItems || 'stretch'};
  margin: ${props => props.margin || '0'};
  padding: ${props => props.padding || '0'};
  width: ${props => props.width || 'auto'};
  height: ${props => props.height || 'auto'};
  max-width: ${props => props.maxWidth || 'none'};
  min-width: ${props => props.minWidth || 'none'};
  direction: ${props => props.dir || undefined};
`;
