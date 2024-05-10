import { Readable } from 'node:stream'
import type { NamedNode } from '@rdfjs/types'
import RDF from '@zazuko/env-node'
import stringToStream from 'string-to-stream'
import { turtle } from '@tpluscode/rdf-string'
import { AnyPointer } from 'clownface'

export function blankNode() {
  return RDF.clownface({ dataset: RDF.dataset() }).blankNode()
}

export function namedNode(uri: string | NamedNode) {
  return RDF.clownface({ dataset: RDF.dataset() }).namedNode(uri)
}

export function any() {
  return RDF.clownface({ dataset: RDF.dataset() })
}

/**
 * Tag function for creating a clownface pointer from a template string.
 */
export async function parse(strings: TemplateStringsArray, ...values: any[]): Promise<AnyPointer> {
  const ttlStream = stringToStream(turtle(strings, ...values).toString())
  const quadStream: Readable = RDF.formats.parsers.import('text/turtle', ttlStream) as any
  const dataset = await RDF.dataset().import(quadStream)
  return RDF.clownface({ dataset })
}
