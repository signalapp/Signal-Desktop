import React from 'react';

import { ActionsPanel } from './session/ActionsPanel';
import { LeftPaneMessageSection } from './session/LeftPaneMessageSection';

import { LeftPaneContactSection } from './session/LeftPaneContactSection';
import { LeftPaneSettingSection } from './session/LeftPaneSettingSection';
import { SessionTheme } from '../state/ducks/SessionTheme';
import { getFocusedSection } from '../state/selectors/section';
import { useSelector } from 'react-redux';
import { getLeftPaneLists } from '../state/selectors/conversations';
import { getQuery, getSearchResults, isSearching } from '../state/selectors/search';
import { SectionType } from '../state/ducks/section';

// from https://github.com/bvaughn/react-virtualized/blob/fb3484ed5dcc41bffae8eab029126c0fb8f7abc0/source/List/types.js#L5
export type RowRendererParamsType = {
  index: number;
  isScrolling: boolean;
  isVisible: boolean;
  key: string;
  parent: Object;
  style: Object;
};

const InnerLeftPaneMessageSection = () => {
  const showSearch = useSelector(isSearching);
  const searchTerm = useSelector(getQuery);

  const searchResults = showSearch ? useSelector(getSearchResults) : undefined;

  const lists = showSearch ? undefined : useSelector(getLeftPaneLists);
  // tslint:disable: use-simple-attributes
  return (
    <LeftPaneMessageSection
      conversations={lists?.conversations || []}
      contacts={lists?.contacts || []}
      searchResults={searchResults}
      searchTerm={searchTerm}
    />
  );
};

const InnerLeftPaneContactSection = () => {
  return <LeftPaneContactSection />;
};

const LeftPaneSection = () => {
  const focusedSection = useSelector(getFocusedSection);

  if (focusedSection === SectionType.Message) {
    return <InnerLeftPaneMessageSection />;
  }

  if (focusedSection === SectionType.Contact) {
    return <InnerLeftPaneContactSection />;
  }
  if (focusedSection === SectionType.Settings) {
    return <LeftPaneSettingSection />;
  }
  return null;
};

export const LeftPane = () => {
  return (
    <SessionTheme>
      <div className="module-left-pane-session">
        <ActionsPanel />

        <div className="module-left-pane">
          <LeftPaneSection />
        </div>
      </div>
    </SessionTheme>
  );
};
