/**
 * Graphics Panel – entry point for the professional photo / graphics editor.
 * Replaces the previous lightweight shape/text helper.
 */

import React from 'react';
import { GraphicsEditor } from '../modules/graphics/GraphicsEditor';

export function GraphicsPanel() {
  return <GraphicsEditor />;
}
