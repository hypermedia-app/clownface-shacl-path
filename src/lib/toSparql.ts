import { NamedNode } from 'rdf-js'
import { SparqlTemplateResult, sparql } from '@tpluscode/rdf-string'
import { MultiPointer } from 'clownface'
import { assertWellFormedPath, fromNode, PathVisitor } from './path'
import * as Path from './path'

class ToSparqlPropertyPath extends PathVisitor<SparqlTemplateResult, { isRoot: boolean }> {
  visitSequencePath({ paths }: Path.SequencePath, { isRoot = true } = {}): SparqlTemplateResult {
    const sequence = paths.reduce(this.pathChain('/'), sparql``)

    if (isRoot) {
      return sequence
    }

    return sparql`(${sequence})`
  }

  visitInversePath({ path: inversed }: Path.InversePath): SparqlTemplateResult {
    return sparql`^${inversed.accept(this, { isRoot: false })}`
  }

  visitAlternativePath({ paths }: Path.AlternativePath, { isRoot = true } = {}): SparqlTemplateResult {
    const alternative = paths.reduce(this.pathChain('|'), sparql``)

    if (isRoot) {
      return alternative
    }

    return sparql`(${alternative})`
  }

  visitZeroOrMorePath({ path: inner }: Path.ZeroOrMorePath): SparqlTemplateResult {
    return sparql`${inner.accept(this, { isRoot: false })}*`
  }

  visitOneOrMorePath({ path: inner }: Path.OneOrMorePath): SparqlTemplateResult {
    return sparql`${inner.accept(this, { isRoot: false })}+`
  }

  visitZeroOrOnePath({ path: inner }: Path.ZeroOrOnePath): SparqlTemplateResult {
    return sparql`${inner.accept(this, { isRoot: false })}?`
  }

  visitPredicatePath({ term: predicate }: Path.PredicatePath): SparqlTemplateResult {
    return sparql`${predicate}`
  }

  private pathChain(operator: string) {
    return (previous: SparqlTemplateResult, current: Path.ShaclPropertyPath, index: number) => {
      if (index === 0) {
        return current.accept(this, { isRoot: false })
      }

      return sparql`${previous}${operator}${current.accept(this, { isRoot: false })}`
    }
  }
}

/**
 * Creates a SPARQL template string which represents a SHACL path as Property Path
 *
 * @param path SHACL Property Path
 */
export function toSparql(path: MultiPointer | NamedNode): SparqlTemplateResult {
  const visitor = new ToSparqlPropertyPath()
  return visitor.visit(fromNode(path))
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
    return [...list].map(el => toSparql(el))
  }

  return [toSparql(path)]
}
