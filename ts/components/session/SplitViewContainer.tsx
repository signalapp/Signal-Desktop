import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';

type SplitViewProps = {
  top: React.ReactElement;
  bottom: React.ReactElement;
  disableTop: boolean;
};

const SlyledSplitView = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
`;

const SplitViewDivider = styled.div`
  width: calc(100% - 2rem);
  height: 2px;
  margin: 1rem;
  border: 2px solid #808080;
  cursor: row-resize;
  flex-shrink: 0;
`;

const StyledTop = styled.div`
  background: red;
  display: flex;
  flex-direction: column;
`;

const TopSplitViewPanel = ({
  children,
  topHeight,
  setTopHeight,
}: {
  children: React.ReactNode;
  topHeight: number | undefined;
  setTopHeight: (value: number) => void;
}) => {
  const topRef = useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (topRef.current) {
      if (!topHeight) {
        setTopHeight(Math.max(MIN_HEIGHT_TOP, topRef.current?.clientHeight / 2));
        return;
      }

      topRef.current.style.height = `${topHeight}px`;
    }
  }, [topRef, topHeight, setTopHeight]);

  return <StyledTop ref={topRef}>{children}</StyledTop>;
};

const MIN_HEIGHT_TOP = 300;
const MIN_HEIGHT_BOTTOM = 0;

export const SplitViewContainer: React.FunctionComponent<SplitViewProps> = ({
  disableTop,
  top,
  bottom,
}) => {
  const [topHeight, setTopHeight] = useState<undefined | number>(undefined);
  const [separatorYPosition, setSeparatorYPosition] = useState<undefined | number>(undefined);
  const [dragging, setDragging] = useState(false);

  const splitPaneRef = useRef<HTMLDivElement | null>(null);

  const onMouseDown = (e: any) => {
    setSeparatorYPosition(e.clientY);
    setDragging(true);
  };

  const onMouseMove = (e: any) => {
    if (dragging && topHeight && separatorYPosition) {
      const newTopHeight = topHeight + e.clientY - separatorYPosition;

      setSeparatorYPosition(e.clientY);
      if (newTopHeight < MIN_HEIGHT_TOP) {
        setTopHeight(MIN_HEIGHT_TOP);
        return;
      }
      if (splitPaneRef.current) {
        const splitPaneHeight = splitPaneRef.current.clientHeight;

        if (newTopHeight > splitPaneHeight - MIN_HEIGHT_BOTTOM) {
          setTopHeight(splitPaneHeight - MIN_HEIGHT_BOTTOM);
          return;
        }
      }
      setTopHeight(newTopHeight);
    }
  };
  useEffect(() => {
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  });

  const onMouseUp = () => {
    setDragging(false);
  };

  return (
    <SlyledSplitView ref={splitPaneRef}>
      {!disableTop && (
        <TopSplitViewPanel topHeight={topHeight} setTopHeight={setTopHeight}>
          {top}
          <SplitViewDivider onMouseDown={onMouseDown} />
        </TopSplitViewPanel>
      )}
      {bottom}
    </SlyledSplitView>
  );
};
