import { configureStore } from '@reduxjs/toolkit';
import modalsReducer from './ducks/modals';
import registrationReducer from './ducks/registration';

export const onboardingStore = configureStore({
  reducer: { modals: modalsReducer, registration: registrationReducer },
});

export type OnboardingStoreState = ReturnType<typeof onboardingStore.getState>;
export type OnboardingStoreDispatch = typeof onboardingStore.dispatch;
