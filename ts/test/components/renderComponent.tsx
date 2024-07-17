/* eslint-disable import/no-extraneous-dependencies */
import { render, RenderOptions } from '@testing-library/react';
import { AnimatePresence, MotionGlobalConfig } from 'framer-motion';
import { ReactElement, ReactNode } from 'react';
import { SessionTheme } from '../../themes/SessionTheme';
import { ErrorBoundary } from 'react-error-boundary';

const Providers = ({ children }: { children: ReactNode }) => {
  MotionGlobalConfig.skipAnimations = false;

  return (
    <SessionTheme>
      <AnimatePresence>
        <ErrorBoundary
          fallback={<>{`Failed to render a component!\n\t${JSON.stringify(children)}`}</>}
        >
          {children}
        </ErrorBoundary>
      </AnimatePresence>
    </SessionTheme>
  );
};

const renderComponent = (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) =>
  render(ui, { wrapper: Providers, ...options });

export { renderComponent };
