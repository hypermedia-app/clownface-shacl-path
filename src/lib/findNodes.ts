import type { NamedNode, Term } from '@rdfjs/types'
import type { MultiPointer } from 'clownface'
import TermSet from '@rdfjs/term-set'
import * as Path from './path.js'
import { ShaclPropertyPath } from './path.js'

interface Context {
  pointer: MultiPointer
}

class FindNodesVisitor extends Path.PathVisitor<Term[], Context> {
  visitSequencePath({ paths }: Path.SequencePath, { pointer }: Context): Term[] {
    return paths.reduce((previous, path) => {
      return pointer.node(path.accept(this, { pointer: previous }))
    }, pointer).terms
  }

  visitInversePath({ path }: Path.InversePath, { pointer }: Context): Term[] {
    if (path instanceof Path.PredicatePath) {
      return pointer.in(path.term).terms
    }

    throw new Error('Only inverse of Predicate Paths is implemented')
  }

  visitAlternativePath({ paths }: Path.AlternativePath, arg: Context): Term[] {
    return paths.flatMap(path => {
      return path.accept(this, arg)
    })
  }

  visitZeroOrOnePath({ path }: Path.ZeroOrOnePath, { pointer }: Context): Term[] {
    return [...pointer.terms, ...path.accept(this, { pointer })]
  }

  visitOneOrMorePath(path: Path.OneOrMorePath, { pointer }: Context): Term[] {
    return this.greedyPath(path, pointer)
  }

  visitZeroOrMorePath(path: Path.ZeroOrMorePath, { pointer }: Context): Term[] {
    return [
      ...pointer.terms,
      ...this.greedyPath(path, pointer),
    ]
  }

  private greedyPath({ path }: Path.OneOrMorePath | Path.ZeroOrMorePath, pointer: MultiPointer): Term[] {
    const remaining = [...pointer.terms]
    const results = new TermSet()

    let current = remaining.pop()
    while (current) {
      const nextNodes = path.accept(this, { pointer: pointer.node(current) })
      for (const nextNode of nextNodes) {
        if (!results.has(nextNode)) {
          remaining.push(nextNode)
          results.add(nextNode)
        }
      }

      current = remaining.pop()
    }

    return [...results]
  }

  visitPredicatePath({ term }: Path.PredicatePath, { pointer }: Context): Term[] {
    return pointer.out(term).terms
  }
}

/**
 * Finds all nodes connected to the input node by following a [SHACL Property Path](https://www.w3.org/TR/shacl/#dfn-shacl-property-path)
 *
 * @param pointer starting node
 * @param shPath SHACL Property Path
 */
export function findNodes(pointer: MultiPointer, shPath: MultiPointer | NamedNode | ShaclPropertyPath): MultiPointer {
  let path: ShaclPropertyPath
  if ('termType' in shPath) {
    path = Path.fromNode(pointer.node(shPath))
  } else if ('value' in shPath) {
    path = Path.fromNode(shPath)
  } else {
    path = shPath
  }
  const terms = new FindNodesVisitor().visit(path, { pointer })

  return pointer.node([...new TermSet(terms)])
}
