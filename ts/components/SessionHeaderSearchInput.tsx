import styled from 'styled-components';

export const SessionHeaderSearchInput = styled.input<{ darkMode: boolean }>`
  color: var(--search-bar-text-control-color);
  background-color: var(--search-bar-background-color);
  border: 1px solid var(--input-border-color);
  padding: 0 26px 0 30px;
  margin-inline-start: 8px;
  margin-inline-end: 8px;
  margin-bottom: 15px;
  outline: 0;
  height: 32px;
  width: calc(100% - 16px);
  outline-offset: -2px;
  font-size: 14px;
  line-height: 18px;
  font-weight: normal;

  position: relative;
  border-radius: '4px';

  ::placeholder {
    color: var(--search-bar-text-control-color);
  }

  :focus {
    border: solid 1px
      var(${props => (props.darkMode ? '--primary-color' : '--search-bar-text-user-color')});
    color: var(--search-bar-text-user-color);
    outline: none;
  }
`;
