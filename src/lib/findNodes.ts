import { NamedNode } from 'rdf-js'
import type { MultiPointer } from 'clownface'
import { sh } from '@tpluscode/rdf-ns-builders'
import TermSet from '@rdf-esm/term-set'

function traverse(node: MultiPointer, path: MultiPointer): MultiPointer {
  if (!path.term) {
    throw new Error('SHACL Path must be single node')
  }

  const list = path.list()
  if (list) {
    return [...list].reduce(traverse, node)
  }

  if (path.term.termType === 'BlankNode') {
    if (path.out(sh.inversePath).term) {
      return node.in(path.out(sh.inversePath).term)
    }

    if (path.out(sh.alternativePath).term) {
      const list = path.out(sh.alternativePath).list()
      if (list) {
        const results = [...list]
          .map(alt => traverse(node, alt))
          .reduce((uniq, mptr) => mptr.toArray().reduce((uniq, ptr) => uniq.add(ptr.term), uniq), new TermSet())

        return node.node(results)
      }

      throw new Error('Object of sh:alternativePath must be an RDF List')
    }

    if (path.out(sh.zeroOrOnePath).term) {
      const outNodes = node.out(path.out(sh.zeroOrOnePath).term)
      return node.node([...node.terms, ...outNodes.terms])
    }

    const orMorePath = path.out([sh.zeroOrMorePath, sh.oneOrMorePath])
    if (orMorePath.term) {
      const results = new TermSet(
        path.out(sh.zeroOrMorePath).term ? node.terms : [],
      )

      let current = node
      let currentTerms = new TermSet(current.terms)
      while (currentTerms.size) {
        const nextNodes = traverse(current, orMorePath).toArray()
        const newResults = new TermSet()
        for (const next of nextNodes) {
          if (!results.has(next.term)) {
            newResults.add(next.term)
            results.add(next.term)
          }
        }

        currentTerms = newResults
        current = node.node([...newResults.values()])
      }

      return node.node([...results.values()])
    }

    throw new Error(`Unrecognized property path ${path.value}`)
  }

  return node.out(path)
}

/**
 * Finds all nodes connected to the input node by following a [SHACL Property Path](https://www.w3.org/TR/shacl/#dfn-shacl-property-path)
 *
 * @param node starting node
 * @param shPath SHACL Property Path
 */
export function findNodes(node: MultiPointer, shPath: MultiPointer | NamedNode): MultiPointer {
  const path = 'termType' in shPath ? node.node(shPath) : shPath
  return traverse(node, path)
}
