# clownface-shacl-path

Provides functions to work with [SHACL Property Paths](https://www.w3.org/TR/shacl/#property-paths)

## Install

```bash
yarn add clownface-shacl-path
```

## Usage

### `findNodes`

Find nodes in RDF/JS graphs by following [SHACL Property Paths](https://www.w3.org/TR/shacl/#property-paths) using [clownface](https://npm.im/clownface) graph traversal library.

The exported function takes two parameters:

1. starting graph pointer node
2. graph pointer to a SHACL Property Path

```js
import { findNodes } from 'clownface-shacl-path'
import fetch from '@rdfjs/fetch'
import $rdf from 'rdf-ext'
import clownface from 'clownface'
import { sh } from '@tpluscode/rdf-ns-builders'

// prepare a clownface Graph Pointer
const response = await fetch('http://zazuko.github.io/tbbt-ld/dist/tbbt.nt', { factory: $rdf })
const amy = clownface({ dataset: await response.dataset() })
    .namedNode('http://localhost:8080/data/person/amy-farrah-fowler')

// prepare a SHACL Property Path structure as clownface
const path = clownface({ dataset: $rdf.dataset() }).blankNode()

/*
  sh:path [
    sh:alternativePath ( # find both
      [ sh:inversePath schema:spouse ] # Sheldon, who is Amy's spouse
      [ sh:inversePath schema:knows ] # Leonard, who knows Amy
    )
  ]
*/
path.addList(sh.alternativePath, [
  path.blankNode().addOut(sh.inversePath, schema.spouse),
  path.blankNode().addOut(sh.inversePath, schema.knows)
])

// find nodes connected by the path
findNodes(amy, path)
```

### `toSparql`

Converts a [SHACL Property Path](https://www.w3.org/TR/shacl/#property-paths) to SPARQL Property Path string template object. Use the property path with [@tpluscode/sparql-builder](https://npm.im/@tpluscode/sparql-builder)

```typescript
import type {GraphPointer} from 'clownface'
import { toSparql } from 'clownface-shacl-path'
import { SELECT } from '@tpluscode/sparql-builder'

/*
 [ sh:path 
   [
     sh:alternativePath (
       ( schema:knows schema:name )
       ( foaf:knows foaf:name )
     )
   ]
 ]
 */
let path: GraphPointer

/*
  SELECT ?friendName
  WHERE {
    ?person a <http://schema.org/Person> .
    ?person (schema:knows|schema:name)|(foaf:knows|foaf:name) ?friendName
  }
 */
SELECT`?friendName`
  .WHERE`
    ?person a <http://schema.org/Person> .
    ?person ${toSparql(path)} ?friendName .
  `.build()
```

### `toSparql.sequence`

In cases when the intermediate nodes of a Sequence Path are important, that path can be split, so that authors can
create and capture variables for all the nodes.

For that purpose, call `toSparql.sequence()`

```typescript
import type {GraphPointer} from 'clownface'
import { toSparql } from 'clownface-shacl-path'
import { SELECT } from '@tpluscode/sparql-builder'
import $rdf from 'rdf-ext'

/*
 [ sh:path ( schema:employee schema:spouse schema:name ) ]
 */
let path: GraphPointer

const sequence = toSparql.sequence(path)

/*
  SELECT *
  WHERE {
    ?path0 schema:employee ?path1 .
    ?path1 schema:spouse ?path2 .
    ?path2 schema:name ?path3 .
  }
 */
const query = sequence.reduce((query, segment, index) => {
  const subject = $rdf.variable(`path${index}`)
  const object = $rdf.variable(`path${index + 1}`)
    
  return query.WHERE`${subject} ${segment} ${object}`
}, SELECT.ALL)
```

## Advanced options

### Allow Named Node Sequence Paths

The SHACL specification requires that lists in Sequence Paths are blank nodes. However, some implementations
may use Named Nodes instead. To allow that, you can manually create the SHACL Property Path object from a graph pointer
and pass it to `findNodes` or `toSparql`:

```typescript
import type { GraphPointer } from 'clownface'
import { findNodes, fromNode } from 'clownface-shacl-path'

let pathNode: GraphPointer
let startNode: GraphPointer

const path = fromNode(pathNode, { allowNamedNodeSequencePaths: true })
const nodes = findNodes(startNode, path)
```

## Advanced Property Path handling

If it is necessary to implement a custom logic for processing of Property Paths, create a class extending from
[`PathVisitor`](src/lib/path.ts). 

```ts
import * as Path from 'clownface-shacl-path'
import type { GraphPointer } from 'clownface'

class MyVisitor extends Path.PathVisitor<TOut, TArg> {
  visitAlternativePath(path: Path.AlternativePath, arg?: TArg): TOut {
  }

  visitInversePath(path: Path.InversePath, arg?: TArg): TOut {
  }

  visitOneOrMorePath(path: Path.OneOrMorePath, arg?: TArg): TOut {
  }

  visitPredicatePath(path: Path.PredicatePath, arg?: TArg): TOut {
  }

  visitSequencePath(path: Path.SequencePath, arg?: TArg): TOut {
  }

  visitZeroOrMorePath(path: Path.ZeroOrMorePath, arg?: TArg): TOut {
  }

  visitZeroOrOnePath(path: Path.ZeroOrOnePath, arg?: TArg): TOut {
  }
}
```

The type arguments are optional. `TOut` defaults to `void` and `TArg` defaults to `unknown`.

See the classes [`ToSparqlPropertyPath`](src/lib/toSparql.ts) and [`FindNodesVisitor`](src/lib/findNodes.ts)
for inspiration

To start visiting path nodes:

```ts
let pathNode: GraphPointer
const visitor = new MyVisitor()
  .visit(Path.fromPointer(pathNode)/*, optional initial arg */)
```
