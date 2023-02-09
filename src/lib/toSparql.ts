import { NamedNode } from 'rdf-js'
import { SparqlTemplateResult, sparql } from '@tpluscode/rdf-string'
import { MultiPointer } from 'clownface'
import { assertWellFormedPath, fromNode, ShaclPropertyPath } from './path'
import * as Path from './path'

function traverse(path: ShaclPropertyPath, { skipParens = false } = {}): SparqlTemplateResult {
  switch (path.type.value) {
    case 'http://www.w3.org/1999/02/22-rdf-syntax-ns#List': {
      const segments = (<Path.SequencePath>path).paths.reduce(pathChain('/'), sparql``)
      if (skipParens) {
        return sparql`${segments}`
      }
      return sparql`(${segments})`
    }

    case 'http://www.w3.org/ns/shacl#inversePath': {
      const inversed = (<Path.InversePath>path).path

      return sparql`^${traverse(inversed)}`
    }

    case 'http://www.w3.org/ns/shacl#alternativePath': {
      const segments = (<Path.SequencePath>path).paths.reduce(pathChain('|'), sparql``)
      if (skipParens) {
        return sparql`${segments}`
      }
      return sparql`(${segments})`
    }

    case 'http://www.w3.org/ns/shacl#zeroOrMorePath': {
      const inner = (<Path.ZeroOrMorePath>path).path
      return sparql`${traverse(inner)}*`
    }

    case 'http://www.w3.org/ns/shacl#oneOrMorePath': {
      const inner = (<Path.OneOrMorePath>path).path

      return sparql`${traverse(inner)}+`
    }

    case 'http://www.w3.org/ns/shacl#zeroOrOnePath': {
      const inner = (<Path.ZeroOrOnePath>path).path

      return sparql`${traverse(inner)}?`
    }

    default: {
      const predicate = (<Path.PredicatePath>path).term
      return sparql`${predicate}`
    }
  }
}

function pathChain(operator: string) {
  return function (previous: SparqlTemplateResult, current: ShaclPropertyPath, index: number) {
    if (index === 0) {
      return traverse(current)
    }

    return sparql`${previous}${operator}${traverse(current)}`
  }
}

/**
 * Creates a SPARQL template string which represents a SHACL path as Property Path
 *
 * @param path SHACL Property Path
 */
export function toSparql(path: MultiPointer | NamedNode): SparqlTemplateResult {
  return traverse(fromNode(path), { skipParens: true })
}

/**
 * Splits a Sequence Path and returns an array of SPARQL template results.
 * If the path is not a Sequence Path, returns an array with a single element
 *
 * @param path SHACL Property Path
 */
toSparql.sequence = (path: MultiPointer): SparqlTemplateResult[] => {
  assertWellFormedPath(path)

  const list = path.list()
  if (list) {
    return [...list].map(toSparql)
  }

  return [toSparql(path)]
}
