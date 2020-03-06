export type SearchOptions = {
  regionCode: string;
  ourNumber: string;
  noteToSelf: string;
  isSecondaryDevice: boolean;
};

export type AdvancedSearchOptions = {
  query: string; 
  from: string; 
  before: number; 
  after: number;
};