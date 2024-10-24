import type { NamedNode } from '@rdfjs/types'
import { GraphPointer, MultiPointer } from 'clownface'
import { sh } from '@tpluscode/rdf-ns-builders'

export abstract class PathVisitor<R = void, TArg = unknown> {
  visit(path: ShaclPropertyPath, arg?: TArg): R {
    if (path instanceof PredicatePath) {
      return this.visitPredicatePath(path, arg)
    }
    if (path instanceof SequencePath) {
      return this.visitSequencePath(path, arg)
    }
    if (path instanceof AlternativePath) {
      return this.visitAlternativePath(path, arg)
    }
    if (path instanceof InversePath) {
      return this.visitInversePath(path, arg)
    }
    if (path instanceof ZeroOrMorePath) {
      return this.visitZeroOrMorePath(path, arg)
    }
    if (path instanceof OneOrMorePath) {
      return this.visitOneOrMorePath(path, arg)
    }
    if (path instanceof ZeroOrOnePath) {
      return this.visitZeroOrOnePath(path, arg)
    }
    if (path instanceof NegatedPropertySet) {
      return this.visitNegatedPropertySet(path, arg)
    }

    throw new Error('Unexpected path')
  }

  abstract visitPredicatePath(path: PredicatePath, arg?: TArg): R
  abstract visitSequencePath(path: SequencePath, arg?: TArg): R
  abstract visitAlternativePath(path: AlternativePath, arg?: TArg): R
  abstract visitInversePath(path: InversePath, arg?: TArg): R
  abstract visitZeroOrMorePath(path: ZeroOrMorePath, arg?: TArg): R
  abstract visitOneOrMorePath(path: OneOrMorePath, arg?: TArg): R
  abstract visitZeroOrOnePath(path: ZeroOrOnePath, arg?: TArg): R
  abstract visitNegatedPropertySet(path: NegatedPropertySet, arg?: TArg): R
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

export class InversePath<P extends ShaclPropertyPath = ShaclPropertyPath> extends ShaclPropertyPath {
  constructor(public path: P) {
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

export class NegatedPropertySet extends ShaclPropertyPath {
  constructor(public paths: Array<PredicatePath | InversePath<PredicatePath>>) {
    super()
  }

  accept<T>(visitor: PathVisitor<any, T>, arg: T) {
    return visitor.visitNegatedPropertySet(this, arg)
  }
}

interface Options {
  allowNamedNodeSequencePaths?: boolean
}

export function fromNode(path: MultiPointer | NamedNode, { allowNamedNodeSequencePaths = false }: Options = {}): ShaclPropertyPath {
  return transformNode({ allowNamedNodeSequencePaths }, path)
}

function transformNode(options: Required<Options>, path: MultiPointer | NamedNode): ShaclPropertyPath {
  if ('termType' in path) {
    return new PredicatePath(path)
  }

  assertWellFormedPath(path)

  if (path.term.termType === 'NamedNode' && !options.allowNamedNodeSequencePaths) {
    return new PredicatePath(path.term)
  }

  const sequence = path.list()
  if (sequence) {
    const paths = [...sequence]
    assertWellFormedShaclList(paths)

    return new SequencePath(paths.map(transformNode.bind(null, options)))
  }

  if (path.term.termType === 'BlankNode') {
    const inversePath = path.out(sh.inversePath)
    if (inversePath.term) {
      return new InversePath(transformNode(options, inversePath))
    }

    const alternativePath = path.out(sh.alternativePath)
    if (alternativePath.term) {
      const list = [...alternativePath.list() || []]
      assertWellFormedShaclList(list)

      return new AlternativePath(list.map(transformNode.bind(null, options)))
    }

    const zeroOrMorePath = path.out(sh.zeroOrMorePath)
    if (zeroOrMorePath.term) {
      return new ZeroOrMorePath(transformNode(options, zeroOrMorePath))
    }

    const oneOrMorePath = path.out(sh.oneOrMorePath)
    if (oneOrMorePath.term) {
      return new OneOrMorePath(transformNode(options, oneOrMorePath))
    }

    const zeroOrOnePath = path.out(sh.zeroOrOnePath)
    if (zeroOrOnePath.term) {
      return new ZeroOrOnePath(transformNode(options, zeroOrOnePath))
    }
  }

  if (path.term.termType === 'NamedNode' && options.allowNamedNodeSequencePaths) {
    return new PredicatePath(path.term)
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
