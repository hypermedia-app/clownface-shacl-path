import { NamedNode } from 'rdf-js'
import { GraphPointer, MultiPointer } from 'clownface'
import { sh } from '@tpluscode/rdf-ns-builders'

export abstract class PathVisitor<R = void, TArg = unknown> {
  visit(path: ShaclPropertyPath, arg?: TArg): R {
    const type = path.constructor.name
    const visit: (path: ShaclPropertyPath, arg?: TArg) => R = (this as any)[`visit${type}`]

    return visit.call(this, path, arg)
  }

  abstract visitPredicatePath(path: PredicatePath, arg: TArg): R
  abstract visitSequencePath(path: SequencePath, arg: TArg): R
  abstract visitAlternativePath(path: AlternativePath, arg: TArg): R
  abstract visitInversePath(path: InversePath, arg: TArg): R
  abstract visitZeroOrMorePath(path: ZeroOrMorePath, arg: TArg): R
  abstract visitOneOrMorePath(path: OneOrMorePath, arg: TArg): R
  abstract visitZeroOrOnePath(path: ZeroOrOnePath, arg: TArg): R
}

export abstract class ShaclPropertyPath {
  abstract accept<R, T>(visitor: PathVisitor<R, T>, arg?: T): R;
}

export class PredicatePath extends ShaclPropertyPath {
  constructor(public term: NamedNode) {
    super()
  }

  accept<T>(visitor: PathVisitor<any, T>, arg: T) {
    return visitor.visitPredicatePath(this, arg)
  }
}

export class SequencePath extends ShaclPropertyPath {
  constructor(public paths: ShaclPropertyPath[]) {
    super()
  }

  accept<T>(visitor: PathVisitor<any, T>, arg: T) {
    return visitor.visitSequencePath(this, arg)
  }
}

export class AlternativePath extends ShaclPropertyPath {
  constructor(public paths: ShaclPropertyPath[]) {
    super()
  }

  accept<T>(visitor: PathVisitor<any, T>, arg: T) {
    return visitor.visitAlternativePath(this, arg)
  }
}

export class InversePath extends ShaclPropertyPath {
  constructor(public path: ShaclPropertyPath) {
    super()
  }

  accept<T>(visitor: PathVisitor<any, T>, arg: T) {
    return visitor.visitInversePath(this, arg)
  }
}

export class ZeroOrMorePath extends ShaclPropertyPath {
  constructor(public path: ShaclPropertyPath) {
    super()
  }

  accept<T>(visitor: PathVisitor<any, T>, arg: T) {
    return visitor.visitZeroOrMorePath(this, arg)
  }
}

export class OneOrMorePath extends ShaclPropertyPath {
  constructor(public path: ShaclPropertyPath) {
    super()
  }

  accept<T>(visitor: PathVisitor<any, T>, arg: T) {
    return visitor.visitOneOrMorePath(this, arg)
  }
}

export class ZeroOrOnePath extends ShaclPropertyPath {
  constructor(public path: ShaclPropertyPath) {
    super()
  }

  accept<T>(visitor: PathVisitor<any, T>, arg: T) {
    return visitor.visitZeroOrOnePath(this, arg)
  }
}

export function fromNode(path: MultiPointer | NamedNode): ShaclPropertyPath {
  if ('termType' in path) {
    return new PredicatePath(path)
  }

  assertWellFormedPath(path)

  if (path.term.termType === 'NamedNode') {
    return new PredicatePath(path.term)
  }

  const sequence = path.list()
  if (sequence) {
    const paths = [...sequence]
    assertWellFormedShaclList(paths)

    return new SequencePath(paths.map(fromNode))
  }

  if (path.term.termType === 'BlankNode') {
    const inversePath = path.out(sh.inversePath)
    if (inversePath.term) {
      return new InversePath(fromNode(inversePath))
    }

    const alternativePath = path.out(sh.alternativePath)
    if (alternativePath.term) {
      const list = [...alternativePath.list() || []]
      assertWellFormedShaclList(list)

      return new AlternativePath(list.map(fromNode))
    }

    const zeroOrMorePath = path.out(sh.zeroOrMorePath)
    if (zeroOrMorePath.term) {
      return new ZeroOrMorePath(fromNode(zeroOrMorePath))
    }

    const oneOrMorePath = path.out(sh.oneOrMorePath)
    if (oneOrMorePath.term) {
      return new OneOrMorePath(fromNode(oneOrMorePath))
    }

    const zeroOrOnePath = path.out(sh.zeroOrOnePath)
    if (zeroOrOnePath.term) {
      return new ZeroOrOnePath(fromNode(zeroOrOnePath))
    }
  }

  throw new Error(`Unrecognized property path ${path.value}`)
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
