import styled from 'styled-components';

export const SessionContextMenuContainer = styled.div.attrs({
  // custom props
})`
  .react-contexify {
    // be sure it is more than the one set for the More Information screen of messages
    z-index: 30;
    min-width: 200px;
    box-shadow: 0px 0px 10px var(--context-menu-shadow-color) !important;
    background-color: var(--context-menu-background-color);

    &.react-contexify__theme--dark {
      background-color: var(--context-menu-background-color);
    }

    .react-contexify__item {
      background: var(--context-menu-background-color);
    }

    .react-contexify__item:not(.react-contexify__item--disabled):hover
      > .react-contexify__item__content {
      background: var(--context-menu-background-hover-color);
      color: var(--context-menu-text-hover-color);
    }
    .react-contexify__item__content {
      transition: var(--default-duration);
      color: var(--context-menu-text-color);
    }

    &.react-contexify__submenu {
      top: -28px !important; // height of an item element
    }

    .react-contexify__submenu-arrow {
      line-height: 16px; // center the arrow for submenu
    }
  }
`;
