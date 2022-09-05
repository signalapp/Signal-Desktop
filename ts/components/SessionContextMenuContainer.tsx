import styled from 'styled-components';

export const SessionContextMenuContainer = styled.div.attrs({
  // custom props
})`
  .react-contexify {
    // be sure it is more than the one set for the More Informations screen of messages
    z-index: 30;
    min-width: 200px;
    box-shadow: 0 10px 16px 0 rgba(var(--color-black-color-rgb), 0.2),
      0 6px 20px 0 rgba(var(--color-black-color-rgb), 0.19) !important;
    background-color: var(--color-received-message-background);

    &.react-contexify__theme--dark {
      background-color: var(--color-received-message-background);
    }

    .react-contexify__item {
      background: var(--color-received-message-background);
    }

    .react-contexify__item:not(.react-contexify__item--disabled):hover
      > .react-contexify__item__content {
      background: var(--color-accent);
      color: var(--color-text-menu-highlighted);
    }
    .react-contexify__item__content {
      transition: var(--default-duration);
      color: var(--color-text);
    }

    &.react-contexify__submenu {
      top: -28px !important; // height of an item element
    }

    .react-contexify__submenu-arrow {
      line-height: 16px; // center the arrow for submenu
    }
  }
`;
