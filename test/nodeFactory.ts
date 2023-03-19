import { NamedNode } from 'rdf-js'
import clownface from 'clownface'
import RDF from '@rdfjs/dataset'

export function blankNode() {
  return clownface({ dataset: RDF.dataset() }).blankNode()
}

export function namedNode(uri: string | NamedNode) {
  return clownface({ dataset: RDF.dataset() }).namedNode(uri)
}

export function any() {
  return clownface({ dataset: RDF.dataset() })
}
