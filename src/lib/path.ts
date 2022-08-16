import { GraphPointer, MultiPointer } from 'clownface'

export function assertWellFormedPath(ptr: MultiPointer): asserts ptr is GraphPointer {
  if (!ptr.term) {
    throw new Error('SHACL Path must be single node')
  }
}
