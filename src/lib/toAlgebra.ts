import type { NamedNode } from '@rdfjs/types'
import { MultiPointer } from 'clownface'
import type { PropertyPath } from 'sparqljs'
import * as Path from './path.js'

class ToAlgebra extends Path.PathVisitor<PropertyPath | NamedNode> {
  visitAlternativePath({ paths }: Path.AlternativePath): PropertyPath {
    return {
      type: 'path',
      pathType: '|',
      items: paths.map(path => path.accept(this)),
    }
  }

  visitInversePath({ path: inversed }: Path.InversePath): PropertyPath {
    return {
      type: 'path',
      pathType: '^',
      items: [inversed.accept(this)],
    }
  }

  visitOneOrMorePath({ path: inner }: Path.OneOrMorePath): PropertyPath {
    return {
      type: 'path',
      pathType: '+',
      items: [inner.accept(this)],
    }
  }

  visitPredicatePath({ term: predicate }: Path.PredicatePath): NamedNode {
    return predicate
  }

  visitSequencePath({ paths }: Path.SequencePath): PropertyPath {
    return {
      type: 'path',
      pathType: '/',
      items: paths.map(path => path.accept(this)),
    }
  }

  visitZeroOrMorePath({ path: inner }: Path.ZeroOrMorePath): PropertyPath {
    return {
      type: 'path',
      pathType: '*',
      items: [inner.accept(this)],
    }
  }

  visitZeroOrOnePath(path: Path.ZeroOrOnePath): PropertyPath {
    return {
      type: 'path',
      pathType: '?',
      items: [path.path.accept(this)],
    }
  }
}

/**
 * Creates a sparqljs object which represents a SHACL path as Property Path
 *
 * @param path SHACL Property Path
 */
export function toAlgebra(path: MultiPointer | NamedNode): PropertyPath | NamedNode {
  const visitor = new ToAlgebra()
  return visitor.visit(Path.fromNode(path))
}
