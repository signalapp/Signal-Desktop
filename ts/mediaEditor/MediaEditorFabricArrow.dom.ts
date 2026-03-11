// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { fabric } from 'fabric';

export class MediaEditorFabricArrow {
  public path: fabric.Path;
  private startPoint: fabric.Point;
  private endPoint: fabric.Point;
  private arrowColor: string;
  private arrowThickness: number;

  constructor(
    start: fabric.Point,
    end: fabric.Point,
    color: string,
    thickness: number
  ) {
    this.startPoint = start;
    this.endPoint = end;
    this.arrowColor = color;
    this.arrowThickness = thickness;

    this.path = new fabric.Path('M 0 0', {
      stroke: color,
      strokeWidth: thickness,
      strokeLineCap: 'round',
      strokeLineJoin: 'round',
      fill: '',
      selectable: true,
      evented: true,
      hasControls: true,
      hasBorders: true,
      perPixelTargetFind: true,
    });
  }

  public updateEnd(newEnd: fabric.Point, curveOffset: number = 0): void {
    this.endPoint = newEnd;
    this.redraw(curveOffset);
  }

  public redraw(curveOffset: number = 0): void {
    const {
      startPoint: start,
      endPoint: end,
      arrowColor: color,
      arrowThickness: thickness,
    } = this;

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const safeDistance = distance || 1;

    // Ensure a minimum arrow length so it's always visible
    const actualEnd =
      distance < 10
        ? new fabric.Point(
            start.x + (dx / safeDistance) * 10,
            start.y + (dy / safeDistance) * 10
          )
        : end;

    const cpX =
      (start.x + actualEnd.x) / 2 + (-dy / safeDistance) * curveOffset;
    const cpY =
      (start.y + actualEnd.y) / 2 + (dx / safeDistance) * curveOffset;

    const tangentX = 2 * (actualEnd.x - cpX);
    const tangentY = 2 * (actualEnd.y - cpY);
    const angle = Math.atan2(tangentY, tangentX);
    const headLength = Math.max(thickness * 5, 18);
    const headAngle = (32 * Math.PI) / 180;

    const p1x = actualEnd.x - headLength * Math.cos(angle - headAngle);
    const p1y = actualEnd.y - headLength * Math.sin(angle - headAngle);
    const p2x = actualEnd.x - headLength * Math.cos(angle + headAngle);
    const p2y = actualEnd.y - headLength * Math.sin(angle + headAngle);

    const pathStr =
      `M ${start.x} ${start.y} Q ${cpX} ${cpY} ${actualEnd.x} ${actualEnd.y} ` +
      `M ${p1x} ${p1y} L ${actualEnd.x} ${actualEnd.y} L ${p2x} ${p2y}`;

    (this.path as any).initialize(pathStr);
    this.path.set({
      stroke: color,
      strokeWidth: thickness,
      strokeLineCap: 'round',
      strokeLineJoin: 'round',
      fill: '',
    });
    this.path.setCoords();
    this.path.dirty = true;
  }
}