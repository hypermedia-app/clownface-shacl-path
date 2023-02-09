import { NamedNode } from 'rdf-js'
import { GraphPointer, MultiPointer } from 'clownface'
import { sh, rdf } from '@tpluscode/rdf-ns-builders'

// eslint-disable-next-line no-use-before-define
export type ShaclPropertyPath = PredicatePath | SequencePath | AlternativePath | InversePath | ZeroOrMorePath | OneOrMorePath | ZeroOrOnePath

export interface PredicatePath {
  type: typeof rdf.predicate
  term: NamedNode
}

export interface SequencePath {
  type: typeof rdf.List
  paths: ShaclPropertyPath[]
}

export interface AlternativePath {
  type: typeof sh.alternativePath
  paths: ShaclPropertyPath[]
}

export interface InversePath {
  type: typeof sh.inversePath
  path: ShaclPropertyPath
}

export interface ZeroOrMorePath {
  type: typeof sh.zeroOrMorePath
  path: ShaclPropertyPath
}

export interface OneOrMorePath {
  type: typeof sh.oneOrMorePath
  path: ShaclPropertyPath
}

export interface ZeroOrOnePath {
  type: typeof sh.zeroOrOnePath
  path: ShaclPropertyPath
}

export function fromNode(path: MultiPointer | NamedNode): ShaclPropertyPath {
  if ('termType' in path) {
    return <PredicatePath>{
      term: path,
      type: rdf.predicate,
    }
  }

  assertWellFormedPath(path)

  const sequence = path.list()
  if (sequence) {
    const paths = [...sequence]
    assertWellFormedShaclList(paths)

    return <SequencePath>{
      type: rdf.List,
      paths: paths.map(fromNode),
    }
  }

  if (path.term.termType === 'BlankNode') {
    const inversePath = path.out(sh.inversePath)
    if (inversePath.term) {
      return <InversePath>{
        type: sh.inversePath,
        path: fromNode(inversePath),
      }
    }

    const alternativePath = path.out(sh.alternativePath)
    if (alternativePath.term) {
      const list = [...alternativePath.list() || []]
      assertWellFormedShaclList(list)

      return <AlternativePath>{
        type: sh.alternativePath,
        paths: list.map(fromNode),
      }
    }

    const zeroOrMorePath = path.out(sh.zeroOrMorePath)
    if (zeroOrMorePath.term) {
      return <ZeroOrMorePath>{
        type: sh.zeroOrMorePath,
        path: fromNode(zeroOrMorePath),
      }
    }

    const oneOrMorePath = path.out(sh.oneOrMorePath)
    if (oneOrMorePath.term) {
      return <OneOrMorePath>{
        type: sh.oneOrMorePath,
        path: fromNode(oneOrMorePath),
      }
    }

    const zeroOrOnePath = path.out(sh.zeroOrOnePath)
    if (zeroOrOnePath.term) {
      return <ZeroOrOnePath>{
        type: sh.zeroOrOnePath,
        path: fromNode(zeroOrOnePath),
      }
    }

    throw new Error(`Unrecognized property path ${path.value}`)
  }

  return <PredicatePath>{
    term: path.term,
    type: rdf.predicate,
  }
}

export function assertWellFormedPath(ptr: MultiPointer): asserts ptr is GraphPointer {
  if (!ptr.term) {
    throw new Error('SHACL Path must be single node')
  }
}

function assertWellFormedShaclList(list: Array<unknown>) {
  if (list.length < 2) {
    throw new Error('SHACL List must have at least 2 elements')
  }
}
