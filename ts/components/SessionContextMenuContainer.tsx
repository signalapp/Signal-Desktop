import styled from 'styled-components';

export const SessionContextMenuContainer = styled.div.attrs({
  // custom props
})`
  .contexify {
    // be sure it is more than the one set for the More Information screen of messages
    z-index: 30;
    min-width: 200px;
    box-shadow: 0px 0px 10px var(--context-menu-shadow-color) !important;
    background-color: var(--context-menu-background-color);

    &.contexify_theme-dark {
      background-color: var(--context-menu-background-color);
    }

    .contexify_item {
      background: var(--context-menu-background-color);
    }

    .contexify_item:not(.contexify_item-disabled):hover > .contexify_itemContent {
      background: var(--context-menu-background-hover-color);
      color: var(--context-menu-text-hover-color);
    }
    .contexify_itemContent {
      transition: var(--default-duration);
      color: var(--context-menu-text-color);
    }

    &.contexify_submenu {
      top: -28px !important; // height of an item element
    }

    .contexify_submenu-arrow {
      line-height: 16px; // center the arrow for submenu
    }
  }
`;
