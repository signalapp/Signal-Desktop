import styled from 'styled-components';

export const SessionHeaderSearchInput = styled.input<{ darkMode: boolean }>`
  color: var(
    ${props => (props.darkMode ? '--color-lighter-gray-color' : '--color-lighter-gray-color')}
  );
  background-color: var(
    ${props => (props.darkMode ? '--color-darkest-gray-color' : '--color-darkest-gray-color')}
  );
  border: 1px solid
    var(${props => (props.darkMode ? '--color-dark-gray-color' : '--color-gray-color')});
  padding: 0 26px 0 30px;
  margin-inline-start: 8px;
  margin-inline-end: 8px;
  outline: 0;
  height: 32px;
  width: calc(100% - 16px);
  outline-offset: -2px;
  font-size: 14px;
  line-height: 18px;
  font-weight: normal;

  position: relative;
  border-radius: ${props => (props.darkMode ? '14px' : '4px')};

  &::placeholder {
    color: var(--color-light-gray-color);
  }

  &:focus {
    border: solid 1px var(${props => (props.darkMode ? '--color-accent' : '--color-text')});
    outline: none;
  }
`;
