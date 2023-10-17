export type SearchOptions = {
  ourNumber: string;
  noteToSelf: string;
  savedMessages: string;
};

export type AdvancedSearchOptions = {
  query: string;
  from?: string;
  before: number;
  after: number;
};
