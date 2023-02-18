# clownface-shacl-path

## 1.5.1

### Patch Changes

- 095115b: Remove the use of `constructor.name` which fails in production builds

## 1.5.0

### Minor Changes

- 573246b: Added `PathVisitor` for custom path processing logic

## 1.4.0

### Minor Changes

- 524835d: Added `toSparql.sequence` which splits a path and returns and array of template results (closes #13)

## 1.3.2

### Patch Changes

- 878c205: Updated `@tpluscode/rdf-ns-builders` to v2

## 1.3.1

### Patch Changes

- 2e15846: `sh:zeroOrOnePath` would only work with direct paths

## 1.3.0

### Minor Changes

- 1b31a25: Add support for `sh:oneOrMorePath` and `sh:zeroOrMorePath`

## 1.2.2

### Patch Changes

- 07f15aa: Modules were built as commonjs

## 1.2.1

### Patch Changes

- 58d8bc8: Remove changesets from dependencies

## 1.2.0

### Minor Changes

- b95ca15: Dual build

## 1.1.0

### Minor Changes

- 3adb204: Added `toSparql` function converting to SPARQL Query template string

### Patch Changes

- c00a12a: findNodes: support `sh:zeroOrOnePath`

## 1.0.2

### Patch Changes

- e20edd5: Update RDF/JS types, rdfine and @tpluscode/rdf-ns-builders

## 1.0.1

### Patch Changes

- 0a4164b: Simplify usage by allowing MultPointer path

## 1.0.0

### Major Changes

- 1f178e4: Extract path traversal package
