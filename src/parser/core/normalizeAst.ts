import { strictEntries } from '@/util';
import { AstNode } from '../core/ast';

export const CONTENT_CLASS_NAMES = [
  'alias',
  'emptyScalar',
  'plainScalar',
  'singleQuotedScalar',
  'doubleQuotedScalar',
  'literalScalar',
  'foldedScalar',
  'blockMapping',
  'flowMapping',
  'flowPair',
  'blockSequence',
  'flowSequence',
] as const;

export const NODE_PROPERTY_CLASS_NAMES = [
  'anchorProperty',
  'tagProperty',
  'annotationProperty',
] as const;

export type ContentNodeClass = (typeof CONTENT_CLASS_NAMES)[number];
export type NodePropertyClass = (typeof NODE_PROPERTY_CLASS_NAMES)[number];

export type NodeClass =
| ContentNodeClass
| NodePropertyClass
| 'stream'
| 'document'
| 'directive'
| 'nodeWithProperties'
| 'blockScalarIndentationIndicator'
| 'blockScalarChompingIndicator'
| 'blockScalarContent'
| 'mappingEntry'
| 'ignore'
| 'annotationName'
| 'annotationArguments';

export type NormalizedAst<TThisName extends NodeClass = NodeClass> = AstNode<NodeClass, TThisName>;
export type NodeClasses = Record<NodeClass, readonly string[]>;

export function normalizeAst(node: AstNode, nodeClasses: NodeClasses): Iterable<NormalizedAst> {
  const nodeNameToClass = new Map(strictEntries(nodeClasses)
    .flatMap(([nodeClass, nodeNames]) =>
      nodeNames.map(name => [name, nodeClass])
    )
  );

  function *rec(nodes: readonly AstNode[]): Iterable<NormalizedAst> {
    for (const node of nodes) {
      const { name, parameters, content, range } = node;
      const nodeClass = nodeNameToClass.get(name);

      if (nodeClass === 'ignore') {
        // pass
      } else if (nodeClass !== undefined) {
        yield {
          name: nodeClass,
          parameters,
          range,
          content: Array.from(rec(content)),
        };
      } else {
        yield* rec(content);
      }
    }
  }

  return rec([node]);
}
