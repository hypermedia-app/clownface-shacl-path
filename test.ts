import * as Path from './src/lib/path.js';
import { SparqlTemplateResult, sparql } from '@tpluscode/rdf-string'
import { foaf, owl, schema, sh } from '@tpluscode/rdf-ns-builders';
import {fromNode} from './src/lib/path.js';
import { Term, Variable } from 'rdf-js';
import $rdf from '@rdf-esm/data-model'
import {blankNode} from "./test/nodeFactory.js";
import namespace from "@rdf-esm/namespace";

interface Context {
  pathStart: Term
  pathEnd?: Term
}

class SparqlPatternVisitor extends Path.PathVisitor<SparqlTemplateResult, Context> {
  private _outPatterns: SparqlTemplateResult[] = []

  constructor(private variable: () => Variable) {
    super();
  }

  get outPatterns() {
    return sparql`${this._outPatterns}`
  }

  visitAlternativePath({ paths }: Path.AlternativePath, { pathStart, pathEnd = this.variable() }: Context): SparqlTemplateResult {
    const [ first, ...rest ] = paths
    return rest.reduce((union, path) => {
      return sparql`${union} UNION {
       ${path.accept(this, { pathStart, pathEnd })}
      }`
    }, sparql`{
      ${first.accept(this, { pathStart, pathEnd })}
    }`)
  }

  visitInversePath({ path }: Path.InversePath, { pathStart, pathEnd = this.variable() }: Context): SparqlTemplateResult {
    return path.accept(this, { pathStart: pathEnd, pathEnd: pathStart });
  }

  visitOneOrMorePath(path: Path.OneOrMorePath, arg: Context) {
    return this.greedyPath(path, arg)
  }

  visitPredicatePath(path: Path.PredicatePath, { pathStart, pathEnd = this.variable() }: Context) {
    const pattern = sparql`${pathStart} ${path.term} ${pathEnd} .`;
    this._outPatterns.push(pattern)
    return pattern
  }

  visitSequencePath({ paths }: Path.SequencePath, { pathStart, pathEnd = this.variable() }: Context): SparqlTemplateResult {
    let patterns = sparql``
    let segStart = pathStart
    let segEnd = this.variable()

    for (const [index, segment] of paths.entries()) {
      patterns = sparql`${patterns}\n${segment.accept(this, {
        pathStart: segStart,
        pathEnd: index === paths.length - 1 ? pathEnd : segEnd
      })}`

      segStart = segEnd
      segEnd = this.variable()
    }

    return patterns
  }

  visitZeroOrMorePath(path: Path.ZeroOrMorePath, arg: Context): SparqlTemplateResult {
    return this.greedyPath(path, arg)
  }

  visitZeroOrOnePath({ path }: Path.ZeroOrOnePath, { pathStart, pathEnd = this.variable() }: Context): SparqlTemplateResult {
    return sparql`{
      BIND(${pathStart} as ${pathEnd})
    } UNION {
      ${path.accept(this, { pathStart, pathEnd })}
    }`;
  }

  private greedyPath({ path }: Path.ZeroOrMorePath | Path.OneOrMorePath, { pathStart, pathEnd = this.variable() }: Context): SparqlTemplateResult {
    if(!(path instanceof Path.PredicatePath)) {
      throw new Error('Only Predicate Path is supported as child of *OrMorePaths')
    }

    const intermediateNode = this.variable()
    const outPattern = sparql`${intermediateNode} ${path.term} ${pathEnd} .`

    this._outPatterns.push(outPattern)
    return sparql`${pathStart} ${path.term}* ${intermediateNode} . \n${outPattern}`;
  }
}

const tbbt = namespace('http://example.com/')

const root = blankNode()
root.addList(sh.path, [
  root.blankNode().addOut(sh.zeroOrOnePath, owl.sameAs),
  root.blankNode().addList(sh.alternativePath, [
    root.blankNode().addOut(sh.oneOrMorePath, schema.knows),
    root.blankNode().addOut(sh.zeroOrMorePath, foaf.account),
    root.blankNode().addList(sh.inversePath, [tbbt.foo, tbbt.bar]),
  ]),
])
const [path] = root.out(sh.path).toArray()

function createVariableSequence(prefix: string) {
  let i = 1
  return () => {
    return $rdf.variable(`${prefix}${i++}`)
  }
}

const visitor = new SparqlPatternVisitor(createVariableSequence('node'))

const wherePatterns = visitor.visit(fromNode(path), {
  pathStart: $rdf.variable('node'),
})

console.log(sparql`CONSTRUCT {
${visitor.outPatterns}
} WHERE {
${wherePatterns}
}`.toString({ prologue: false }))
