// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import * as sinon from 'sinon';

describe('WaveformScrubberDragging', () => {
  let isDragging = false;
  let wasPlayingBeforeDrag = false;
  let onScrubMock: sinon.SinonSpy;
  let mockDocument: {
    addEventListener: sinon.SinonSpy;
    removeEventListener: sinon.SinonSpy;
  };
  let mockAudio: {
    playing: boolean;
    duration: number;
    currentTime: number;
    play: sinon.SinonSpy;
    pause: sinon.SinonSpy;
  };

  beforeEach(() => {
    mockDocument = {
      addEventListener: sinon.spy(),
      removeEventListener: sinon.spy(),
    };
    mockAudio = {
      playing: true,
      duration: 10,
      currentTime: 0,
      play: sinon.spy(),
      pause: sinon.spy(),
    };
    isDragging = false;
    wasPlayingBeforeDrag = false;
  });

  function calculatePositionAsRatio(clientX: number): number {
    return clientX / 100;
  }

  function handleMouseDown(): void {
    isDragging = true;
    wasPlayingBeforeDrag = mockAudio.playing;

    if (wasPlayingBeforeDrag) {
      mockAudio.pause();
    }

    mockDocument.addEventListener('mousemove', handleMouseMove);
    mockDocument.addEventListener('mouseup', handleMouseUp);
  }

  function handleMouseMove(event: { clientX: number }): void {
    if (!isDragging) {
      return;
    }

    const positionAsRatio = calculatePositionAsRatio(event.clientX);
    onScrubMock(positionAsRatio);
    mockAudio.currentTime = positionAsRatio * mockAudio.duration;
  }

  function handleMouseUp(): void {
    isDragging = false;

    mockDocument.removeEventListener('mousemove', handleMouseMove);
    mockDocument.removeEventListener('mouseup', handleMouseUp);

    if (wasPlayingBeforeDrag) {
      mockAudio.play();
    }
  }

  it('should call onScrub with correct ratio while dragging', () => {
    onScrubMock = sinon.spy();

    handleMouseDown();

    assert.isTrue(mockAudio.pause.calledOnce, 'pause should be called');

    const mouseMoveHandlerEntry = mockDocument.addEventListener.args.find(
      (args: Array<unknown>) => args[0] === 'mousemove'
    );

    if (!mouseMoveHandlerEntry) {
      throw new Error('mousemove handler not found');
    }

    const mouseMoveHandler = mouseMoveHandlerEntry[1] as (event: {
      clientX: number;
    }) => void;

    mouseMoveHandler({ clientX: 40 });

    assert.isTrue(onScrubMock.calledOnce, 'onScrub should be called once');
    assert.closeTo(
      onScrubMock.args[0][0] as number,
      0.4,
      0.05,
      'onScrub called with ~0.4'
    );

    assert.equal(mockAudio.currentTime, 4, 'currentTime should be 4 seconds');

    const mouseUpHandlerEntry = mockDocument.addEventListener.args.find(
      (args: Array<unknown>) => args[0] === 'mouseup'
    );

    if (!mouseUpHandlerEntry) {
      throw new Error('mouseup handler not found');
    }

    const mouseUpHandler = mouseUpHandlerEntry[1] as () => void;

    mouseUpHandler();

    assert.isFalse(isDragging, 'Dragging should be stopped');
    assert.isTrue(mockAudio.play.calledOnce, 'play should be called');

    assert.isTrue(
      mockDocument.removeEventListener.calledWith('mousemove', handleMouseMove),
      'mousemove listener should be removed'
    );

    assert.isTrue(
      mockDocument.removeEventListener.calledWith('mouseup', handleMouseUp),
      'mouseup listener should be removed'
    );
  });
});
