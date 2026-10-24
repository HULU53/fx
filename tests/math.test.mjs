import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const engine = require('../src/common/math/engine.js')
const parser = require('../src/common/math/parser.js')
const Fraction = require('../src/common/math/fraction.js').Fraction
const Polynomial = require('../src/common/math/polynomial.js').Polynomial
const graphImage = require('../src/common/math/graph-image.js')

function run(moduleId, modeId, lines) {
  return engine.run(moduleId, modeId, lines)
}

test('fraction arithmetic stays exact', () => {
  assert.equal(new Fraction(1, 3).add(new Fraction(1, 6)).toString(), '1/2')
  assert.equal(new Fraction(3, 4).div(new Fraction(9, 8)).toString(), '2/3')
  assert.equal(new Fraction(2, 3).pow(3).toString(), '8/27')
})

test('parser handles precedence, powers and implicit multiplication', () => {
  const polynomial = parser.expressionToPolynomial(parser.parseExpression('2x^2-3x+1'))
  assert.equal(polynomial.toString(), '2x² - 3x + 1')
  const product = parser.expressionToPolynomial(parser.parseExpression('(x+1)(x-1)'))
  assert.equal(product.toString(), 'x² - 1')
})

test('polynomial expansion and factorization', () => {
  const expanded = run('polynomial', 'simplify', ['(x+2)(x-3)'])
  assert.equal(expanded.ok, true)
  assert.equal(expanded.exact[0], 'x² - x - 6')

  const difference = run('polynomial', 'factor', ['x^2-9'])
  assert.equal(difference.ok, true)
  assert.equal(difference.exact[0], '(x - 3)(x + 3)')

  const square = run('polynomial', 'factor', ['x^2+6x+9'])
  assert.equal(square.exact[0], '(x + 3)²')

  const common = run('polynomial', 'factor', ['2x^2+4x'])
  assert.equal(common.exact[0], '2x(x + 2)')

  const scaledDifference = run('polynomial', 'factor', ['4x^2-9'])
  assert.equal(scaledDifference.exact[0], '(2x - 3)(2x + 3)')

  const scaledSquare = run('polynomial', 'factor', ['4x^2+12x+9'])
  assert.equal(scaledSquare.exact[0], '(2x + 3)²')
})

test('rational expressions cancel factors and preserve domain restrictions', () => {
  const simplified = run('rational', 'simplify', ['(x^2-1)/(x+1)'])
  assert.equal(simplified.ok, true)
  assert.equal(simplified.exact[0], 'x - 1')
  assert.match(simplified.domain, /x ≠ -1/)
})

test('radicals simplify, combine and rationalize simple denominators', () => {
  const combined = run('radical', 'simplify', ['√18-√8'])
  assert.equal(combined.ok, true)
  assert.equal(combined.exact[0], '√2')

  const divided = run('radical', 'simplify', ['√12/√3'])
  assert.equal(divided.exact[0], '2')

  const rationalized = run('radical', 'simplify', ['1/(2+√3)'])
  assert.equal(rationalized.ok, true)
  assert.equal(rationalized.exact[0], '2 - √3')
})

test('quadratic equations return exact roots', () => {
  const result = run('equations', 'quadratic', ['x^2-5x+6=0'])
  assert.equal(result.ok, true)
  assert.deepEqual(result.exact, ['x1 = 3', 'x2 = 2'])

  const irrational = run('equations', 'quadratic', ['x^2-2=0'])
  assert.equal(irrational.ok, true)
  assert.equal(irrational.exact[0], 'x1 = √2')
  assert.equal(irrational.exact[1], 'x2 = -√2')

  const complex = run('equations', 'quadratic', ['x^2+1=0'])
  assert.equal(complex.ok, true)
  assert.equal(complex.exact[0], '无实数解')
})

test('fractional equations reject extraneous roots', () => {
  const solvable = run('equations', 'rational', ['1/(x-1)=2'])
  assert.equal(solvable.ok, true)
  assert.equal(solvable.exact[0], 'x = 3/2')

  const extraneous = run('equations', 'rational', ['(x^2-1)/(x-1)=2'])
  assert.equal(extraneous.ok, true)
  assert.equal(extraneous.exact[0], '无解')
})

test('linear systems handle unique, inconsistent and dependent cases', () => {
  const unique = run('equations', 'system', ['x+y=5', 'x-y=1'])
  assert.deepEqual(unique.exact, ['x = 3', 'y = 2'])

  const inconsistent = run('equations', 'system', ['x+y=1', 'x+y=2'])
  assert.equal(inconsistent.exact[0], '无解')

  const dependent = run('equations', 'system', ['x+y=1', '2x+2y=2'])
  assert.equal(dependent.exact[0], '无穷多组解')
})

test('linear inequality systems intersect their solution sets', () => {
  const one = run('equations', 'inequality', ['-2x+3<=5'])
  assert.equal(one.exact[0], 'x ≥ -1')

  const system = run('equations', 'inequality', ['x+1>2', '2x<=8'])
  assert.equal(system.exact[0], '1 < x ≤ 4')

  const empty = run('equations', 'inequality', ['x>3', 'x<1'])
  assert.equal(empty.exact[0], '无解')

  const quadraticOutside = run('equations', 'inequality', ['x^2>1'])
  assert.equal(quadraticOutside.exact[0], 'x < -1 或 x > 1')

  const mixedSystem = run('equations', 'inequality', [
    '1+3x>2x(x-1)',
    '(x+5)/3>2x'
  ])
  assert.equal(mixedSystem.ok, true)
  assert.equal(mixedSystem.exact[0], '5/4 - 1/4√33 < x < 1')

  const quadraticInside = run('equations', 'inequality', ['x^2-4<=0', 'x>0'])
  assert.equal(quadraticInside.exact[0], '0 < x ≤ 2')
})

test('function analysis returns exact forms, key points and graph data', () => {
  const linear = run('linear', 'graph', ['y=2x+1'])
  assert.equal(linear.ok, true)
  assert.equal(linear.graph.type, 'linear')
  assert.equal(linear.graph.yMin <= 1, true)

  const inverse = run('inverse', 'graph', ['y=-6/x'])
  assert.equal(inverse.ok, true)
  assert.equal(inverse.domain, 'x ≠ 0')
  assert.equal(inverse.graph.lines.length, 2)

  const quadratic = run('quadratic', 'graph', ['y=x^2-4x+3'])
  assert.equal(quadratic.ok, true)
  assert.equal(quadratic.exact[0], 'y = x² - 4x + 3')
  assert.equal(quadratic.exact[1], 'y = (x - 2)² - 1')
  assert.match(quadratic.exact[2], /\(x - 3\)\(x - 1\)/)
  assert.equal(quadratic.graph.keyPoints.length >= 4, true)

  const png = new Uint8Array(graphImage.createGraphPng(quadratic.graph))
  assert.deepEqual(Array.from(png.slice(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10])
  assert.equal(png.length > 1000, true)
})

test('invalid and oversized inputs return friendly errors', () => {
  const empty = run('equations', 'linear', [''])
  assert.equal(empty.ok, false)
  assert.match(empty.error, /请输入/)

  const tooLong = run('polynomial', 'simplify', ['x'.repeat(121)])
  assert.equal(tooLong.ok, false)
  assert.match(tooLong.error, /120/)

  const bad = run('polynomial', 'simplify', ['x$2'])
  assert.equal(bad.ok, false)
  assert.match(bad.error, /不支持/)
})

test('polynomial gcd supports rational expression reduction', () => {
  const left = new Polynomial({ 2: 1, 1: -3, 0: 2 })
  const right = new Polynomial({ 1: 1, 0: -1 })
  const quotient = left.div(right)
  assert.equal(quotient.toString(), 'x - 2')
})

test('single-letter A-Z variables work in algebra, fractions and equations', () => {
  const expanded = run('polynomial', 'simplify', ['(A+2)(A-3)'])
  assert.equal(expanded.ok, true)
  assert.equal(expanded.exact[0], 'A² - A - 6')

  const factored = run('polynomial', 'factor', ['B^2-9'])
  assert.equal(factored.ok, true)
  assert.equal(factored.exact[0], '(B - 3)(B + 3)')

  const rational = run('rational', 'simplify', ['(D^2-1)/(D+1)'])
  assert.equal(rational.ok, true)
  assert.equal(rational.exact[0], 'D - 1')
  assert.match(rational.domain, /D ≠ -1/)

  const equation = run('equations', 'quadratic', ['C^2-5C+6=0'])
  assert.equal(equation.ok, true)
  assert.deepEqual(equation.exact, ['C1 = 3', 'C2 = 2'])
})
