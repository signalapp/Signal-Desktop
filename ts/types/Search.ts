export type SearchOptions = {
  ourNumber: string;
  noteToSelf: string;
};

export type AdvancedSearchOptions = {
  query: string;
  from?: string;
  before: number;
  after: number;
};
