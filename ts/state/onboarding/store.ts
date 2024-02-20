import { configureStore } from '@reduxjs/toolkit';
import modalsReducer from './ducks/modals';

export const onboardingStore = configureStore({
  reducer: { modals: modalsReducer },
});

export type OnboardingStoreState = ReturnType<typeof onboardingStore.getState>;
export type OnboardingStoreDispatch = typeof onboardingStore.dispatch;
