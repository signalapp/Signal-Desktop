import styled from 'styled-components';

type PillContainerProps = {
  children: React.ReactNode;
  margin?: string;
  padding?: string;
  onClick?: () => void;
  disableHover?: boolean;
};

export const StyledPillContainerHoverable = styled.div<PillContainerProps>`
  background: none;
  position: relative;
  flex-direction: 'row';
  flex-shrink: 0;
  min-width: 50%;
  max-width: 100%;
  white-space: nowrap;
  text-overflow: ellipsis;
  align-items: center;
  padding: ${props => props.padding || ''};
  margin: ${props => props.margin || ''};
`;

const StyledPillInner = styled.div<PillContainerProps>`
  background: none;

  display: flex;
  flex-direction: 'row';
  flex-grow: 1;
  flex-shrink: 0;

  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;

  align-items: center;
  padding: ${props => props.padding || ''};
  margin: ${props => props.margin || ''};
  border-radius: 300px;
  cursor: ${props => (props.disableHover ? 'unset' : 'pointer')};
  border: 1px solid var(--border-color);
  transition: var(--default-duration);
  &:hover {
    background: ${props =>
      props.disableHover ? 'none' : 'var(--button-solid-background-hover-color)'};
  }
`;

export const PillContainerHoverable = (props: Omit<PillContainerProps, 'disableHover'>) => {
  return (
    <StyledPillInner {...props} disableHover={!props.onClick}>
      {props.children}
    </StyledPillInner>
  );
};
