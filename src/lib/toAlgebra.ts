import type { NamedNode } from '@rdfjs/types'
import { MultiPointer } from 'clownface'
import type { InversePathInPropertySet, IriTerm, PropertyPath } from 'sparqljs'
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

  visitNegatedPropertySet({ paths }: Path.NegatedPropertySet): PropertyPath {
    return {
      type: 'path',
      pathType: '!',
      items: paths.map((path): IriTerm | InversePathInPropertySet => {
        if (path instanceof Path.PredicatePath) {
          return path.term
        }

        return {
          type: 'path',
          pathType: '^',
          items: [path.path.term],
        }
      }),
    }
  }
}

/**
 * Creates a sparqljs object which represents a SHACL path as Property Path
 *
 * @param shPath SHACL Property Path
 */
export function toAlgebra(shPath: MultiPointer | NamedNode | Path.ShaclPropertyPath): PropertyPath | NamedNode {
  let path: Path.ShaclPropertyPath
  if ('termType' in shPath || 'value' in shPath) {
    path = Path.fromNode(shPath)
  } else {
    path = shPath
  }

  const visitor = new ToAlgebra()
  return visitor.visit(path)
}
