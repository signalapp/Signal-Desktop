// Copyright 2025 Orbital
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { Meta } from '@storybook/react';
import { OrbitalThreadingDemo } from './OrbitalThreadingDemo';

const { i18n } = window.SignalContext;

export default {
  title: 'Orbital/ThreadingDemo',
  component: OrbitalThreadingDemo,
} satisfies Meta;

/**
 * Orbital Threading UI Demo
 *
 * Showcases the complete threaded discussion interface with:
 * - Thread list sidebar with day separators
 * - Color-coded reply depth system (Blue → Purple → Blue → Purple)
 * - Early 2000s internet aesthetic (Verdana, retro styling)
 * - ASCII art separators
 * - Reply levels 0-4+ with increasing color saturation
 */
export function FullDemo(): JSX.Element {
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        padding: '12px 16px',
        background: '#5B9FED',
        color: 'white',
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '16px',
        fontWeight: 'bold',
        borderBottom: '2px solid #3D7BC4'
      }}>
        🌐 Orbital Threading Demo
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <OrbitalThreadingDemo i18n={i18n} />
      </div>
    </div>
  );
}

/**
 * Thread List Only
 *
 * Shows just the thread list sidebar with day separators
 */
export function ThreadListOnly(): JSX.Element {
  return (
    <div style={{ width: '320px', height: '600px', border: '2px solid #D1D5DB' }}>
      <OrbitalThreadingDemo i18n={i18n} />
    </div>
  );
}

/**
 * Color Depth Guide
 *
 * Visual guide showing the 5 reply depth levels and their colors
 */
export function ColorDepthGuide(): JSX.Element {
  return (
    <div style={{
      padding: '32px',
      background: '#FAF9F7',
      fontFamily: 'Verdana, sans-serif',
      fontSize: '13px'
    }}>
      <h1 style={{
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '32px',
        fontWeight: 'bold',
        marginBottom: '24px',
        color: '#2A2D35'
      }}>
        Orbital Reply Depth Color System
      </h1>

      <p style={{ marginBottom: '32px', color: '#6B7280', lineHeight: '1.5' }}>
        Replies are color-coded by depth with alternating blue/purple pattern and increasing saturation.
        Indentation increases by 24px per level (max 96px at level 4+).
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Level 0 */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderLeft: '3px solid #D1D5DB',
          borderRadius: '3px',
          padding: '12px',
          marginLeft: '0px'
        }}>
          <strong>Level 0 (Top-level post):</strong> White background, gray border, 0px indent
        </div>

        {/* Level 1 */}
        <div style={{
          background: 'rgba(91, 159, 237, 0.08)',
          border: '1px solid #E5E7EB',
          borderLeft: '3px solid #5B9FED',
          borderRadius: '3px',
          padding: '12px',
          marginLeft: '24px'
        }}>
          <strong>Level 1 (First reply):</strong> Light blue (8% opacity), blue border, 24px indent
        </div>

        {/* Level 2 */}
        <div style={{
          background: 'rgba(155, 135, 245, 0.08)',
          border: '1px solid #E5E7EB',
          borderLeft: '3px solid #9B87F5',
          borderRadius: '3px',
          padding: '12px',
          marginLeft: '48px'
        }}>
          <strong>Level 2 (Nested reply):</strong> Light purple (8% opacity), purple border, 48px indent
        </div>

        {/* Level 3 */}
        <div style={{
          background: 'rgba(91, 159, 237, 0.12)',
          border: '1px solid #E5E7EB',
          borderLeft: '3px solid #5B9FED',
          borderRadius: '3px',
          padding: '12px',
          marginLeft: '72px'
        }}>
          <strong>Level 3 (Deeper nesting):</strong> Stronger blue (12% opacity), blue border, 72px indent
        </div>

        {/* Level 4+ */}
        <div style={{
          background: 'rgba(155, 135, 245, 0.12)',
          border: '1px solid #E5E7EB',
          borderLeft: '3px solid #9B87F5',
          borderRadius: '3px',
          padding: '12px',
          marginLeft: '96px'
        }}>
          <strong>Level 4+ (Max depth):</strong> Stronger purple (12% opacity), purple border, 96px max indent
        </div>
      </div>

      <div style={{
        marginTop: '32px',
        padding: '16px',
        background: '#F2F0ED',
        borderRadius: '3px',
        fontFamily: 'Courier New, monospace',
        fontSize: '12px',
        color: '#6B7280',
        lineHeight: '1.8'
      }}>
        <strong>Pattern:</strong> Blue → Purple → Blue → Purple (alternating)<br/>
        <strong>Saturation:</strong> 8% opacity for levels 1-2, 12% for levels 3+<br/>
        <strong>Indentation:</strong> 24px per level, maximum 96px<br/>
        <strong>Accessibility:</strong> Color + indent = double reinforcement (works without color)
      </div>
    </div>
  );
}

/**
 * ASCII Art Elements
 *
 * Shows the retro ASCII art decorations used throughout the UI
 */
export function ASCIIArtElements(): JSX.Element {
  return (
    <div style={{
      padding: '32px',
      background: '#FAF9F7',
      fontFamily: 'Verdana, sans-serif'
    }}>
      <h1 style={{
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '32px',
        fontWeight: 'bold',
        marginBottom: '24px',
        color: '#2A2D35'
      }}>
        ASCII Art Elements
      </h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div>
          <h3 style={{ fontWeight: 'bold', marginBottom: '8px' }}>Day Separator</h3>
          <div style={{
            fontFamily: 'Courier New, monospace',
            fontSize: '11px',
            color: '#9CA3AF',
            textAlign: 'center',
            padding: '12px 0'
          }}>
            ─── Today ───
          </div>
        </div>

        <div>
          <h3 style={{ fontWeight: 'bold', marginBottom: '8px' }}>Section Separator</h3>
          <div style={{
            fontFamily: 'Courier New, monospace',
            fontSize: '11px',
            color: '#9CA3AF',
            textAlign: 'center',
            padding: '8px 0',
            letterSpacing: '0.2em'
          }}>
            ·  ·  ·  ✦  ·  ·  ·
          </div>
        </div>

        <div>
          <h3 style={{ fontWeight: 'bold', marginBottom: '8px' }}>Empty State Box</h3>
          <div style={{
            fontFamily: 'Courier New, monospace',
            fontSize: '11px',
            color: '#9CA3AF',
            whiteSpace: 'pre',
            padding: '8px',
            border: '1px solid #E5E7EB',
            borderRadius: '3px',
            background: '#F2F0ED',
            textAlign: 'center'
          }}>
{`╭───────────────────────╮
│   No threads yet      │
│   Create your first!  │
╰───────────────────────╯`}
          </div>
        </div>

        <div>
          <h3 style={{ fontWeight: 'bold', marginBottom: '8px' }}>Line Separator</h3>
          <div style={{
            fontFamily: 'Courier New, monospace',
            fontSize: '11px',
            color: '#9CA3AF',
            textAlign: 'center'
          }}>
            ─────────────────────────────────
          </div>
        </div>

        <div>
          <h3 style={{ fontWeight: 'bold', marginBottom: '8px' }}>Dot Separator</h3>
          <div style={{
            fontFamily: 'Courier New, monospace',
            fontSize: '11px',
            color: '#9CA3AF',
            textAlign: 'center'
          }}>
            • • • • • • • • • • • • • • • • •
          </div>
        </div>
      </div>

      <div style={{
        marginTop: '32px',
        padding: '16px',
        background: '#F2F0ED',
        borderRadius: '3px',
        fontSize: '12px',
        color: '#6B7280',
        lineHeight: '1.6'
      }}>
        <strong>Philosophy:</strong> Subtle BBS/forum nostalgia. ASCII art should enhance,
        not distract. Maximum 2-3 ASCII elements per screen. All decorative elements use
        Courier New monospace and tertiary text color (#9CA3AF).
      </div>
    </div>
  );
}
