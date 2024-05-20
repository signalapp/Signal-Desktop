/* eslint-disable import/no-extraneous-dependencies */
import { render, RenderOptions } from '@testing-library/react';
import { AnimatePresence } from 'framer-motion';
import { ReactElement, ReactNode } from 'react';
import { SessionTheme } from '../../themes/SessionTheme';

const Providers = ({ children }: { children: ReactNode }) => {
  return (
    <SessionTheme>
      <AnimatePresence>{children}</AnimatePresence>
    </SessionTheme>
  );
};

const renderComponent = (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) =>
  render(ui, { wrapper: Providers, ...options });

export * from '@testing-library/react';
export { renderComponent };
