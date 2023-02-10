import * as Path from './src/lib/path.js';
import { SparqlTemplateResult, sparql } from '@tpluscode/rdf-string'
import { schema } from '@tpluscode/rdf-ns-builders';
import {fromNode} from './src/lib/path.js';
import { Term } from 'rdf-js';
import $rdf from 'rdf-ext'

interface Context {
  pathStart: Term
  pathEnd: Term
}

class SparqlPatternVisitor extends Path.PathVisitor<SparqlTemplateResult, Context> {
  visitAlternativePath(path: Path.AlternativePath, arg: unknown) {
    return sparql`lol`;
  }

  visitInversePath(path: Path.InversePath, arg: unknown) {
    return sparql`lol`;
  }

  visitOneOrMorePath(path: Path.OneOrMorePath, arg: unknown) {
    return sparql`lol`;
  }

  visitPredicatePath(path: Path.PredicatePath, { pathStart, pathEnd }: Context) {
    return sparql`${pathStart} ${path.term} ${pathEnd}\n`;
  }

  visitSequencePath(path: Path.SequencePath, arg: unknown) {
    return sparql`lol`;
  }

  visitZeroOrMorePath(path: Path.ZeroOrMorePath, arg: unknown) {
    return sparql`lol`;
  }

  visitZeroOrOnePath(path: Path.ZeroOrOnePath, arg: unknown) {
    return sparql`lol`;
  }
}

const path = schema.knows

console.log(new SparqlPatternVisitor().visit(fromNode(path), {
  pathStart: $rdf.variable('node'),
  pathEnd: $rdf.variable('node1')
}).toString())
