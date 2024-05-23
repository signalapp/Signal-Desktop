export type SearchOptions = {
  ourNumber: string;
  noteToSelf: string;
  savedMessages: string;
  filter?: 'contacts' | 'conversations';
};

export type AdvancedSearchOptions = {
  query: string;
  from?: string;
  before: number;
  after: number;
};
