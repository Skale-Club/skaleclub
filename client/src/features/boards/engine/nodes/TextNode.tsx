import { memo } from 'react';
import { useBoardStoreApi } from '../../store/boardStore';
import { commitNodeText } from '../../canvas/actions';
import { CanvasNodeShell, NodeTextEditor, cn, selectionRing, useNodeEditing, type BoardNodeProps } from './nodeUtils';

// A free text block that sizes itself to its content (auto width; lines only
// break where you press Shift+Enter). An empty block is removed when editing ends.
export const TextNode = memo(function TextNode({ id, data, selected }: BoardNodeProps<'text'>) {
  const store = useBoardStoreApi();
  const { editing, seed } = useNodeEditing(id);
  const fontSize = data.fontSize ?? 18;
  return (
    <CanvasNodeShell id={id} selected={selected} data={data} testId="board-node-text">
      <div
        className={cn('min-w-[24px] px-1 font-medium leading-[1.3] text-[var(--board-node-fg)]', selectionRing(selected))}
        style={{ fontSize, textAlign: data.align ?? 'left', color: data.color, borderRadius: 4 }}
      >
        {editing && !data.meta.readOnly ? (
          <NodeTextEditor
            initial={data.text}
            seed={seed}
            wrap={false}
            placeholder="Text"
            ariaLabel="Text"
            testId="text-editor"
            onCommit={(text) => commitNodeText(store, id, { text }, { removeIfEmpty: true })}
          />
        ) : (
          <span className={cn('whitespace-pre', !data.text.trim() && 'opacity-40')} data-testid="text-node-content">
            {data.text.trim() ? data.text : 'Text'}
          </span>
        )}
      </div>
    </CanvasNodeShell>
  );
});
