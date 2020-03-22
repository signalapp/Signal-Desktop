import React from 'react';
import { SessionIconButton, SessionIconSize, SessionIconType } from './icon';
import { ContextMenu, ContextMenuTrigger, MenuItem } from 'react-contextmenu';

interface Props {
  searchString: string;
  onChange: any;
  handleNavigation?: any;
  placeholder: string;
}

export class SessionSearchInput extends React.Component<Props> {
  public constructor(props: Props) {
    super(props);
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  public render() {
    const { searchString } = this.props;
    const triggerId = 'session-search-input-context';

    return (
      <>
        <ContextMenuTrigger id={triggerId}>
          <div className="session-search-input">
            <SessionIconButton
              iconSize={SessionIconSize.Medium}
              iconType={SessionIconType.Search}
            />
            <input
              value={searchString}
              onChange={e => this.props.onChange(e.target.value)}
              onKeyDown={this.handleKeyDown}
              placeholder={this.props.placeholder}
            />
          </div>
        </ContextMenuTrigger>
        <ContextMenu id={triggerId}>
          <MenuItem onClick={() => document.execCommand('undo')}>
            {window.i18n('editMenuUndo')}
          </MenuItem>
          <MenuItem onClick={() => document.execCommand('redo')}>
            {window.i18n('editMenuRedo')}
          </MenuItem>
          <hr />
          <MenuItem onClick={() => document.execCommand('cut')}>
            {window.i18n('editMenuCut')}
          </MenuItem>
          <MenuItem onClick={() => document.execCommand('copy')}>
            {window.i18n('editMenuCopy')}
          </MenuItem>
          <MenuItem onClick={() => document.execCommand('paste')}>
            {window.i18n('editMenuPaste')}
          </MenuItem>
          <MenuItem onClick={() => document.execCommand('selectAll')}>
            {window.i18n('editMenuSelectAll')}
          </MenuItem>
        </ContextMenu>
      </>
    );
  }

  public handleKeyDown(e: any) {
    if (e.keyCode === 38 || e.keyCode === 40 || e.key === 'Enter') {
      // Up or Bottom arrow pressed
      if (this.props.handleNavigation) {
        e.stopPropagation();
        this.props.handleNavigation(e);
      }
    }
  }
}
