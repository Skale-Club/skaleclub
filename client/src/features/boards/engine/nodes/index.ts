import type { NodeTypes } from '@xyflow/react';
import { MindNode } from './MindNode';
import { StickyNode } from './StickyNode';
import { ShapeNode } from './ShapeNode';
import { TextNode } from './TextNode';
import { FrameNode } from './FrameNode';
import { ImageNode } from './ImageNode';

export { MindNode, StickyNode, ShapeNode, TextNode, FrameNode, ImageNode };

// Keyed by BoardNodeData['type'] (toFlow sets node.type = data.type).
export const boardNodeTypes = {
  mind: MindNode,
  sticky: StickyNode,
  shape: ShapeNode,
  text: TextNode,
  frame: FrameNode,
  image: ImageNode,
} as unknown as NodeTypes;
