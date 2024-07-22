import { AnimatePresence, MotionGlobalConfig } from 'framer-motion';
import { isArray, isEqual, unset } from 'lodash';
import { ElementType, ReactElement, ReactNode } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import TestRenderer from 'react-test-renderer';
import { SessionTheme } from '../../themes/SessionTheme';

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

function renderComponent(children: ReactElement): TestRenderer.ReactTestRenderer {
  return TestRenderer.create(<Providers>{children}</Providers>);
}

function getComponentTree(
  result: TestRenderer.ReactTestRenderer
): Array<TestRenderer.ReactTestRendererTree> {
  const trees = result.toTree();
  return !trees ? [] : isArray(trees) ? trees : [trees];
}

function findByDataTestId(
  renderResult: TestRenderer.ReactTestRenderer,
  dataTestId: string
): TestRenderer.ReactTestInstance {
  return renderResult.root.findByProps({ 'data-testid': dataTestId });
}

function findAllByElementType(
  renderResult: TestRenderer.ReactTestRenderer,
  elementType: ElementType
): Array<TestRenderer.ReactTestInstance> {
  return renderResult.root.findAllByType(elementType);
}

function areResultsEqual(
  renderResult: TestRenderer.ReactTestRenderer,
  renderResult2: TestRenderer.ReactTestRenderer,
  ignoreDataTestIds?: boolean
): boolean {
  if (ignoreDataTestIds) {
    const obj = renderResult.toJSON();
    const obj2 = renderResult2.toJSON();
    unset(obj, "props['data-testid']");
    unset(obj2, "props['data-testid']");
    return isEqual(obj, obj2);
  }

  return isEqual(renderResult.toJSON(), renderResult2.toJSON());
}

export {
  areResultsEqual,
  findAllByElementType,
  findByDataTestId,
  getComponentTree,
  renderComponent,
};
