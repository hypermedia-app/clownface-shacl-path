import { NamedNode, BlankNode, Term } from 'rdf-js'
import { expect } from 'chai'
import { describe, it } from 'mocha'
import { schema, sh, skos, foaf, rdf, owl } from '@tpluscode/rdf-ns-builders'
import type { GraphPointer } from 'clownface'
import RDF from '@rdfjs/data-model'
import namespace from '@rdfjs/namespace'
import { findNodes, toSparql } from '../src/index.js'
import { any, blankNode, namedNode } from './nodeFactory.js'

const tbbt = namespace('http://example.com/')

describe('clownface-shacl-path', () => {
  describe('findNodes', () => {
    const graph = any()

    const sheldon = graph.namedNode(tbbt.Sheldon)
      .addOut(schema.knows, [tbbt.Penny, tbbt.Howard, tbbt.Amy, tbbt.Leonard])
      .addOut(schema.spouse, tbbt.Amy)

    const amy = graph.namedNode(tbbt.Amy)
      .addOut(schema.knows, tbbt.Leonard)
      .addOut(skos.prefLabel, 'Amy')
      .addOut(skos.altLabel, 'Amy Farrah-Fowler')

    const penny = graph.namedNode(tbbt.Penny)

    const leonard = graph.namedNode(tbbt.Leonard)
      .addOut(schema.spouse, tbbt.Penny)
      .addOut(schema.knows, [tbbt.Sheldon, tbbt.Amy])

    it('follows direct path as named node', () => {
      // given
      const path = schema.knows

      // when
      const nodes = findNodes(sheldon, path)

      // then
      expect(nodes.terms).to.deep.contain.members([tbbt.Penny, tbbt.Howard, tbbt.Amy, tbbt.Leonard])
    })

    it('follows direct path as pointer', () => {
      // given
      const path = schema.knows

      // when
      const nodes = findNodes(sheldon, namedNode(path))

      // then
      expect(nodes.terms).to.deep.contain.members([tbbt.Penny, tbbt.Howard, tbbt.Amy, tbbt.Leonard])
    })

    it('follows simple inverse path', () => {
      // given
      const path = blankNode().addOut(sh.inversePath, schema.spouse)

      // when
      const nodes = findNodes(penny, path)

      // then
      expect(nodes.term).to.deep.eq(leonard.term)
    })

    it('follows simple alternative path', () => {
      // given
      const path = blankNode().addList(sh.alternativePath, [schema.spouse, schema.knows])

      // when
      const nodes = findNodes(leonard, path)

      // then
      expect(nodes.terms).to.deep.contain.members([tbbt.Penny, tbbt.Sheldon])
    })

    it('follows simple sequence path', () => {
      // given
      const [path] = blankNode().addList(sh.path, [schema.knows, schema.spouse]).out(sh.path).toArray()

      // when
      const nodes = findNodes(sheldon, path)

      // then
      expect(nodes.term).to.deep.eq(tbbt.Penny)
    })

    it('follows a zero-or-one path', () => {
      // given
      /*
       sh:path [
         sh:zeroOrOnePath schema:spouse
       ]
       */
      const path = blankNode()
      path.addOut(sh.zeroOrOnePath, schema.spouse)

      // when
      const nodes = findNodes(sheldon, path)

      // then
      expect(nodes.terms).to.deep.contain.members([
        tbbt.Sheldon,
        tbbt.Amy,
      ])
    })

    it('follows a complex zero-or-one path', () => {
      // given
      /*
       sh:path [
         sh:zeroOrOnePath [ sh:alternativePath ( schema:spouse foaf:knows ) ]
       ]
       */
      const path = blankNode()
      path.addOut(sh.zeroOrOnePath, zeroOrOne => {
        zeroOrOne.addList(sh.alternativePath, [schema.spouse, foaf.knows])
      })

      // when
      const nodes = findNodes(sheldon, path)

      // then
      expect(nodes.terms).to.deep.contain.members([
        tbbt.Sheldon,
        tbbt.Amy,
      ])
    })

    it('returns self if zero-or-one path has no matched', () => {
      // given
      /*
       sh:path [
         sh:zeroOrOnePath schema:knows
       ]
       */
      const path = blankNode()
      path.addOut(sh.zeroOrOnePath, foaf.knows)

      // when
      const nodes = findNodes(sheldon, path)

      // then
      expect(nodes.term).to.deep.eq(tbbt.Sheldon)
    })

    it('follows sequence path of two inverse paths', () => {
      // given
      /*
       sh:path (
         [ sh:inversePath schema:spouse ] # Leonard is Penny's spouse
         [ sh:inversePath schema:knows ]  # Sheldon and Amy know Leonard
       )
       */
      const root = blankNode()
      root.addList(sh.path, [
        root.blankNode().addOut(sh.inversePath, schema.spouse),
        root.blankNode().addOut(sh.inversePath, schema.knows),
      ])
      const [path] = root.out(sh.path).toArray()

      // when
      const nodes = findNodes(penny, path)

      // then
      expect(nodes.terms).to.deep.contain.members([tbbt.Sheldon, tbbt.Amy])
    })

    it('follows sequence path of predicate paths followed by alternative path', () => {
      // given
      /*
       sh:path (
         schema:knows # Leonard knows Sheldon (among others)
         schema:spouse # Amy is Sheldon's spouse
         [ sh:alternativePath ( skos:prefLabel skos:altLabel ) ] # Amy has two labels
       )
       */
      const root = blankNode()
      root.addList<NamedNode | BlankNode>(sh.path, [
        schema.knows,
        schema.spouse,
        root.blankNode().addList(sh.alternativePath, [skos.prefLabel, skos.altLabel]),
      ])
      const [path] = root.out(sh.path).toArray()

      // when
      const nodes = findNodes(leonard, path)

      // then
      expect(nodes.terms).to.deep.contain.members([RDF.literal('Amy'), RDF.literal('Amy Farrah-Fowler')])
    })

    it('follows an alternative of two inverse paths', () => {
      // given
      /*
       sh:path [
         sh:alternativePath ( # find both
           [ sh:inversePath schema:spouse ] # Sheldon, who is Amy's spouse
           [ sh:inversePath schema:knows ] # Leonard, who knows Amy
         )
       ]
       */
      const path = blankNode()
      path.addList(sh.alternativePath, [
        path.blankNode().addOut(sh.inversePath, schema.spouse),
        path.blankNode().addOut(sh.inversePath, schema.knows),
      ])

      // when
      const nodes = findNodes(amy, path)

      // then
      expect(nodes.terms).to.deep.contain.members([tbbt.Sheldon, tbbt.Leonard])
    })

    it('throws when there are multiple paths in pointer', () => {
      // given
      const path = graph.addOut(sh.path).addOut(sh.path).has(sh.path)

      // then
      expect(() => findNodes(blankNode(), path)).to.throw(Error)
    })

    it('throws when there are no paths in pointer', () => {
      // given
      const path = graph.has(sh.path)

      // then
      expect(() => findNodes(blankNode(), path)).to.throw(Error)
    })

    describe('*-or-more paths', () => {
      const shape = graph.namedNode('shape')
        .addList(sh.and, [namedNode('and1'), namedNode('and2')])
        .addList(sh.xone, [namedNode('xone1'), namedNode('xone2')])
        .addList(sh.or, [namedNode('or1'), namedNode('or2')])

      it('follows one-or-more path', () => {
        // given
        /*
         sh:path (
           [ sh:alternativePath ( sh:and sh:or ) ]
           [ sh:oneOrMorePath rdf:rest ]
           rdf:first
         )
         */
        const root = blankNode()
        root.addList<Term>(sh.path, [
          root.blankNode().addList(sh.alternativePath, [sh.and, sh.or]),
          root.blankNode().addOut(sh.oneOrMorePath, rdf.rest),
          rdf.first,
        ])
        const [path] = root.out(sh.path).toArray()

        // when
        const nodes = findNodes(shape, path)

        // then
        expect(nodes.terms).to.deep.contain.members([
          namedNode('and2').term,
          namedNode('or2').term,
        ])
      })

      it('follows zero-or-more path', () => {
        // given
        /*
         sh:path (
           [ sh:alternativePath ( sh:and sh:or ) ]
           [ sh:zeroOrMorePath rdf:rest ]
           rdf:first
         )
         */
        const root = blankNode()
        root.addList<Term>(sh.path, [
          root.blankNode().addList(sh.alternativePath, [sh.and, sh.or]),
          root.blankNode().addOut(sh.zeroOrMorePath, rdf.rest),
          rdf.first,
        ])
        const [path] = root.out(sh.path).toArray()

        // when
        const nodes = findNodes(shape, path)

        // then
        expect(nodes.terms).to.deep.contain.members([
          namedNode('and1').term,
          namedNode('and2').term,
          namedNode('or1').term,
          namedNode('or2').term,
        ])
      })
    })

    describe('throws when path is not supported', () => {
      const unsupportedPaths: [string, GraphPointer][] = [
        ['sh:alternativePath not a list', blankNode().addOut(sh.alternativePath)],
        ['path is not any SHACL Property Path', blankNode()],
      ]

      for (const [title, path] of unsupportedPaths) {
        it(title, () => {
          expect(() => findNodes(blankNode(), path)).to.throw(Error)
        })
      }
    })
  })

  describe('toSparql', () => {
    it('converts direct path', () => {
      // given
      const path = schema.knows

      // when
      const sparql = toSparql(path).toString({ prologue: false })

      // then
      expect(sparql).to.eq('schema:knows')
    })

    it('converts simple inverse path', () => {
      // given
      const path = blankNode().addOut(sh.inversePath, schema.spouse)

      // when
      const sparql = toSparql(path).toString({ prologue: false })

      // then
      expect(sparql).to.eq('^schema:spouse')
    })

    it('converts simple alternative path', () => {
      // given
      const path = blankNode().addList(sh.alternativePath, [schema.spouse, schema.knows])

      // when
      const sparql = toSparql(path).toString({ prologue: false })

      // then
      expect(sparql).to.eq('schema:spouse|schema:knows')
    })

    it('converts simple sequence path', () => {
      // given
      const path = blankNode().addList(sh.path, [schema.knows, schema.spouse]).out(sh.path)

      // when
      const sparql = toSparql(path).toString({ prologue: false })

      // then
      expect(sparql).to.eq('schema:knows/schema:spouse')
    })

    it('converts sequence path of two inverse paths', () => {
      // given
      /*
       sh:path (
         [ sh:inversePath schema:spouse ] # Leonard is Penny's spouse
         [ sh:inversePath schema:knows ]  # Sheldon and Amy know Leonard
       )
       */
      const root = blankNode()
      root.addList(sh.path, [
        root.blankNode().addOut(sh.inversePath, schema.spouse),
        root.blankNode().addOut(sh.inversePath, schema.knows),
      ])
      const path = root.out(sh.path)

      // when
      const sparql = toSparql(path).toString({ prologue: false })

      // then
      expect(sparql).to.eq('^schema:spouse/^schema:knows')
    })

    it('converts sequence path of predicate paths followed by alternative path', () => {
      // given
      /*
       sh:path (
         schema:knows # Leonard knows Sheldon (among others)
         schema:spouse # Amy is Sheldon's spouse
         [ sh:alternativePath ( skos:prefLabel skos:altLabel ) ] # Amy has two labels
       )
       */
      const root = blankNode()
      root.addList<NamedNode | BlankNode>(sh.path, [
        schema.knows,
        schema.spouse,
        root.blankNode().addList(sh.alternativePath, [skos.prefLabel, skos.altLabel]),
      ])
      const path = root.out(sh.path)

      // when
      const sparql = toSparql(path).toString({ prologue: false })

      // then
      expect(sparql).to.eq('schema:knows/schema:spouse/(skos:prefLabel|skos:altLabel)')
    })

    it('converts alternative of two sequence paths', () => {
      // given
      /*
       sh:path [
         sh:alternativePath (
           ( schema:knows schema:name )
           ( foaf:knows foaf:name )
         )
       )
       */
      const path = blankNode()
      path.addList(sh.alternativePath, [
        path.blankNode()
          .addOut(rdf.first, schema.knows)
          .addOut(rdf.rest, rest => rest.addOut(rdf.first, schema.name).addOut(rdf.rest, rdf.nil)),
        path.blankNode()
          .addOut(rdf.first, foaf.knows)
          .addOut(rdf.rest, rest => rest.addOut(rdf.first, foaf.name).addOut(rdf.rest, rdf.nil)),
      ])

      // when
      const sparql = toSparql(path).toString({ prologue: false })

      // then
      expect(sparql).to.eq('(schema:knows/schema:name)|(foaf:knows/foaf:name)')
    })

    it('converts an alternative of two inverse paths', () => {
      // given
      /*
       sh:path [
         sh:alternativePath ( # find both
           [ sh:inversePath schema:spouse ] # Sheldon, who is Amy's spouse
           [ sh:inversePath schema:knows ] # Leonard, who knows Amy
         )
       ]
       */
      const path = blankNode()
      path.addList(sh.alternativePath, [
        path.blankNode().addOut(sh.inversePath, schema.spouse),
        path.blankNode().addOut(sh.inversePath, schema.knows),
      ])

      // when
      const sparql = toSparql(path).toString({ prologue: false })

      // then
      expect(sparql).to.eq('^schema:spouse|^schema:knows')
    })

    it('converts a zero-or-more path', () => {
      // given
      /*
       sh:path [
         sh:zeroOrMorePath schema:knows
       ]
       */
      const path = blankNode()
      path.addOut(sh.zeroOrMorePath, schema.knows)

      // when
      const sparql = toSparql(path).toString({ prologue: false })

      // then
      expect(sparql).to.eq('schema:knows*')
    })

    it('converts a one-or-more path', () => {
      // given
      /*
       sh:path [
         sh:oneOrMorePath schema:knows
       ]
       */
      const path = blankNode()
      path.addOut(sh.oneOrMorePath, schema.knows)

      // when
      const sparql = toSparql(path).toString({ prologue: false })

      // then
      expect(sparql).to.eq('schema:knows+')
    })

    it('converts a zero-or-one path', () => {
      // given
      /*
       sh:path [
         sh:zeroOrOnePath schema:knows
       ]
       */
      const path = blankNode()
      path.addOut(sh.zeroOrOnePath, schema.knows)

      // when
      const sparql = toSparql(path).toString({ prologue: false })

      // then
      expect(sparql).to.eq('schema:knows?')
    })

    it('converts a zero-or-one sequence path', () => {
      // given
      /*
       sh:path [
         sh:zeroOrOnePath ( schema:knows schema:name )
       ]
       */
      const path = blankNode()
      path.addList(sh.zeroOrOnePath, [schema.knows, schema.name])

      // when
      const sparql = toSparql(path).toString({ prologue: false })

      // then
      expect(sparql).to.eq('(schema:knows/schema:name)?')
    })

    it('converts a zero-or-more sequence path', () => {
      // given
      /*
       sh:path [
         sh:zeroOrMorePath ( schema:knows schema:name )
       ]
       */
      const path = blankNode()
      path.addList(sh.zeroOrMorePath, [schema.knows, schema.name])

      // when
      const sparql = toSparql(path).toString({ prologue: false })

      // then
      expect(sparql).to.eq('(schema:knows/schema:name)*')
    })

    it('converts a one-or-more sequence path', () => {
      // given
      /*
       sh:path [
         sh:oneOrMorePath ( schema:knows schema:name )
       ]
       */
      const path = blankNode()
      path.addList(sh.oneOrMorePath, [schema.knows, schema.name])

      // when
      const sparql = toSparql(path).toString({ prologue: false })

      // then
      expect(sparql).to.eq('(schema:knows/schema:name)+')
    })

    it('converts a zero-or-more alt path', () => {
      // given
      /*
       sh:path [
         sh:zeroOrMorePath [
           sh:alternativePath ( schema:knows schema:name )
         ]
       ]
       */
      const path = blankNode()
      path.addOut(sh.zeroOrMorePath, (bn) => {
        bn.addList(sh.alternativePath, [schema.knows, schema.name])
      })

      // when
      const sparql = toSparql(path).toString({ prologue: false })

      // then
      expect(sparql).to.eq('(schema:knows|schema:name)*')
    })

    it('converts a one-or-more alt path', () => {
      // given
      /*
       sh:path [
         sh:oneOrMorePath [
           sh:alternativePath ( schema:knows schema:name )
         ]
       ]
       */
      const path = blankNode()
      path.addOut(sh.oneOrMorePath, (bn) => {
        bn.addList(sh.alternativePath, [schema.knows, schema.name])
      })

      // when
      const sparql = toSparql(path).toString({ prologue: false })

      // then
      expect(sparql).to.eq('(schema:knows|schema:name)+')
    })

    it('converts a complex combination of paths', () => {
      // given
      /*
       sh:path (
         [ sh:zeroOrOnePath owl:sameAs ]
         [
           sh:alternativePath (
             [ sh:oneOrMorePath schema:knows ]
             [ sh:zeroOrMorePath (owl:sameAs foaf:name) ]
             [ sh:inversePath ( ex:foo ex:bar ) ]
           )
         ]
       )
       */
      const root = blankNode()
      root.addList(sh.path, [
        root.blankNode().addOut(sh.zeroOrOnePath, owl.sameAs),
        root.blankNode().addList(sh.alternativePath, [
          root.blankNode().addOut(sh.oneOrMorePath, schema.knows),
          root.blankNode().addList(sh.zeroOrMorePath, [owl.sameAs, foaf.name]),
          root.blankNode().addList(sh.inversePath, [tbbt.foo, tbbt.bar]),
        ]),
      ])
      const [path] = root.out(sh.path).toArray()

      // when
      const sparql = toSparql(path).toString({ prologue: false })

      // then
      expect(sparql).to.eq('owl:sameAs?/(schema:knows+|(owl:sameAs/foaf:name)*|^(<http://example.com/foo>/<http://example.com/bar>))')
    })

    it('throws when there are multiple paths in pointer', () => {
      // given
      const path = blankNode().addOut(sh.path).addOut(sh.path).has(sh.path)

      // then
      expect(() => toSparql(path)).to.throw(Error)
    })

    it('throws when sh:alternativePath not a list', () => {
      // given
      const path = blankNode().addOut(sh.alternativePath)

      // then
      expect(() => toSparql(path)).to.throw(Error)
    })

    it('throws when sh:alternativePath has one element', () => {
      // given
      const path = blankNode().addList(sh.alternativePath, [schema.knows])

      // then
      expect(() => toSparql(path)).to.throw(Error)
    })

    it('throws when path has one element', () => {
      // given
      const root = blankNode()
      root.addList(sh.path, [
        schema.spouse,
      ])
      const [path] = root.out(sh.path).toArray()

      // then
      expect(() => toSparql(path)).to.throw(Error)
    })

    it('throws when path is not any SHACL Property Path', () => {
      // given
      const path = blankNode()

      // then
      expect(() => toSparql(path)).to.throw(Error)
    })
  })

  describe('toSparql.sequence', () => {
    it('returns a single element when path is Predicate Path', () => {
      // given
      const path = namedNode(schema.knows)

      // when
      const [segment] = toSparql.sequence(path)

      // then
      expect(segment.toString({ prologue: false })).to.deep.eq('schema:knows')
    })

    it('returns each segment as individual sparql property path', () => {
      // given
      const root = blankNode()
      root.addList(sh.path, [
        root.blankNode().addOut(sh.zeroOrOnePath, owl.sameAs),
        root.blankNode().addList(sh.alternativePath, [
          root.blankNode().addOut(sh.oneOrMorePath, schema.knows),
          root.blankNode().addList(sh.zeroOrMorePath, [owl.sameAs, foaf.name]),
        ]),
        root.blankNode().addList(sh.inversePath, [tbbt.foo, tbbt.bar]),
      ])
      const [path] = root.out(sh.path).toArray()

      // when
      const [first, second, last] = toSparql.sequence(path).map(segment => segment.toString({ prologue: false }))

      // then
      expect(first).to.eq('owl:sameAs?')
      expect(second).to.eq('schema:knows+|(owl:sameAs/foaf:name)*')
      expect(last).to.eq('^(<http://example.com/foo>/<http://example.com/bar>)')
    })
  })
})
