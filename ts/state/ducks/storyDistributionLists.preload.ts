// STUB: Stories feature removed

export type StoryDistributionListDataType = {
  id: string;
  name: string;
};

export type StoryDistributionListStateType = {
  distributionLists: ReadonlyArray<StoryDistributionListDataType>;
};

export const actions = {};

export const useStoryDistributionListsActions = () => actions;

export const getEmptyState = (): StoryDistributionListStateType => ({
  distributionLists: [],
});

export const reducer = (state = getEmptyState()): StoryDistributionListStateType => state;
