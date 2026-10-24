'use strict'

const Fraction = require('./fraction').Fraction
const ZERO = require('./fraction').ZERO
const ONE = require('./fraction').ONE
const gcd = require('./fraction').gcd
const lcm = require('./fraction').lcm
const Polynomial = require('./polynomial').Polynomial
const polynomialGcd = require('./polynomial').polynomialGcd
const RationalExpression = require('./rational-expression').RationalExpression
const RadicalSum = require('./radical').RadicalSum
const fractionSquareRoot = require('./radical').fractionSquareRoot
const rationalSquareRoot = require('./radical').rationalSquareRoot
const parser = require('./parser')
const graphs = require('./graph')

function emptyResult(kind) {
  return {
    ok: false,
    kind: kind || 'error',
    exact: [],
    approximate: [],
    steps: [],
    domain: '',
    graph: null,
    error: ''
  }
}

function errorResult(message, kind) {
  const result = emptyResult(kind)
  result.error = message
  return result
}

function successResult(kind, exact, steps, options) {
  const extra = options || {}
  return {
    ok: true,
    kind: kind,
    title: extra.title || '',
    exact: Array.isArray(exact) ? exact : [String(exact)],
    approximate: Array.isArray(extra.approximate) ? extra.approximate : [],
    steps: Array.isArray(steps) ? steps : [],
    domain: extra.domain || '',
    graph: extra.graph || null,
    error: ''
  }
}

function approximateFraction(value) {
  return Number(Fraction.from(value).toNumber().toFixed(2)).toString()
}

function polynomialCoefficientBounds(polynomial) {
  const keys = Object.keys(polynomial.coefficients)
  let max = 1
  for (let index = 0; index < keys.length; index += 1) {
    max = Math.max(max, Math.abs(polynomial.coefficients[keys[index]].n))
  }
  return max
}

function ensureDegree(polynomial, maxDegree, label) {
  if (polynomial.degree() > maxDegree) {
    throw new Error((label || '多项式') + '的次数不能超过 ' + maxDegree)
  }
}

function polynomialRealRoots(polynomial) {
  const value = Polynomial.from(polynomial)
  const degree = value.degree()
  if (degree < 0) {
    return { type: 'all' }
  }
  if (degree === 0) {
    return { type: 'none' }
  }
  if (degree === 1) {
    const a = value.coefficient(1)
    const b = value.coefficient(0)
    return {
      type: 'real',
      roots: [RadicalSum.fromFraction(b.neg().div(a))]
    }
  }
  if (degree === 2) {
    const a = value.coefficient(2)
    const b = value.coefficient(1)
    const c = value.coefficient(0)
    const discriminant = b.mul(b).sub(new Fraction(4, 1).mul(a).mul(c))
    if (discriminant.sign() < 0) {
      return { type: 'complex', discriminant: discriminant }
    }
    const denominator = new Fraction(2, 1).mul(a)
    const base = RadicalSum.fromFraction(b.neg().div(denominator))
    const radicalPart = fractionSquareRoot(discriminant).mul(
      RadicalSum.fromFraction(denominator.inv())
    )
    return {
      type: 'real',
      discriminant: discriminant,
      roots: [
        base.add(radicalPart),
        base.sub(radicalPart)
      ]
    }
  }
  throw new Error('当前只支持一元一次和一元二次方程')
}

function formatRadicalSign(value) {
  const text = value.toString()
  return text.charAt(0) === '-' ? '- ' + text.slice(1) : '+ ' + text
}

function evaluatePolynomialRadical(polynomial, value) {
  let result = RadicalSum.fromFraction(ZERO)
  let power = RadicalSum.fromFraction(ONE)
  const degree = polynomial.degree()
  for (let current = 0; current <= degree; current += 1) {
    const coefficient = polynomial.coefficient(current)
    if (!coefficient.isZero()) {
      result = result.add(power.mul(RadicalSum.fromFraction(coefficient)))
    }
    if (current < degree) {
      power = power.mul(value)
    }
  }
  return result
}

function formatLinearFactor(root, variableName) {
  const text = root.toString()
  const name = variableName || 'x'
  return text.charAt(0) === '-' ? '(' + name + ' + ' + text.slice(1) + ')' : '(' + name + ' - ' + text + ')'
}

function formatScaledLinearFactor(lead, constant, variableName) {
  const name = variableName || 'x'
  const leadText = lead.isOne() ? name : lead.toString() + name
  if (constant.isZero()) {
    return '(' + leadText + ')'
  }
  return constant.sign() < 0
    ? '(' + leadText + ' + ' + constant.abs().toString() + ')'
    : '(' + leadText + ' - ' + constant.toString() + ')'
}

function contentAndPrimitive(polynomial) {
  const degree = polynomial.degree()
  if (degree < 0) {
    return { content: ONE, primitive: polynomial }
  }
  let denominatorLcm = 1
  let numeratorGcd = 0
  const coefficients = []
  for (let current = 0; current <= degree; current += 1) {
    const coefficient = polynomial.coefficient(current)
    coefficients.push(coefficient)
    denominatorLcm = lcm(denominatorLcm, coefficient.d)
    numeratorGcd = gcd(numeratorGcd, coefficient.n)
  }
  const content = new Fraction(numeratorGcd || 1, denominatorLcm)
  return {
    content: content,
    primitive: polynomial.scale(content.inv())
  }
}

function factorPolynomial(polynomial) {
  let value = Polynomial.from(polynomial)
  const variableName = value.variableName
  if (value.isZero()) {
    return { ok: true, text: '0', steps: ['零多项式不需要因式分解'] }
  }
  const content = contentAndPrimitive(value)
  value = content.primitive
  let xPower = 0
  while (value.degree() > 0 && value.coefficient(0).isZero()) {
    value = new Polynomial(Object.keys(value.coefficients).reduce(function (result, key) {
      const degree = Number(key)
      if (degree > 0) {
        result[degree - 1] = value.coefficients[key]
      }
      return result
    }, {}), variableName)
    xPower += 1
  }
  let remainderText = ''
  let factorFound = false
  if (value.degree() === 2) {
    const a = value.coefficient(2)
    const b = value.coefficient(1)
    const c = value.coefficient(0)
    if (b.isZero()) {
      const rootA = rationalSquareRoot(a)
      const rootC = rationalSquareRoot(c.neg())
      if (rootA && rootC) {
        remainderText = formatScaledLinearFactor(rootA, rootC, variableName) +
          formatScaledLinearFactor(rootA, rootC.neg(), variableName)
        factorFound = true
      }
    }
    if (!factorFound) {
      const rootA = rationalSquareRoot(a)
      const rootC = rationalSquareRoot(c)
      if (rootA && rootC) {
        const middle = new Fraction(2, 1).mul(rootA).mul(rootC)
        if (b.equals(middle)) {
          remainderText = formatScaledLinearFactor(rootA, rootC.neg(), variableName) + '²'
          factorFound = true
        } else if (b.equals(middle.neg())) {
          remainderText = formatScaledLinearFactor(rootA, rootC, variableName) + '²'
          factorFound = true
        }
      }
    }
    if (!factorFound) {
      const discriminant = b.mul(b).sub(new Fraction(4, 1).mul(a).mul(c))
      const rootDiscriminant = rationalSquareRoot(discriminant)
      if (rootDiscriminant) {
        const denominator = new Fraction(2, 1).mul(a)
        const root1 = b.neg().add(rootDiscriminant).div(denominator)
        const root2 = b.neg().sub(rootDiscriminant).div(denominator)
        const lead = a
        const leadText = lead.isOne() ? '' : lead.toString()
        remainderText = leadText + formatLinearFactor(root1, variableName) +
          formatLinearFactor(root2, variableName)
        factorFound = true
      }
    }
  }
  if (!factorFound) {
    remainderText = value.toString()
  }
  const pieces = []
  if (!content.content.isOne()) {
    pieces.push(content.content.toString())
  }
  if (xPower === 1) {
    pieces.push(variableName)
  } else if (xPower > 1) {
    pieces.push(variableName + '²')
  }
  if (remainderText !== '1') {
    if ((xPower > 0 || !content.content.isOne()) &&
      remainderText.indexOf(' ') >= 0 &&
      remainderText.charAt(0) !== '(') {
      remainderText = '(' + remainderText + ')'
    }
    pieces.push(remainderText)
  }
  const text = pieces.join('') || '1'
  return {
    ok: factorFound || xPower > 0 || !content.content.isOne(),
    text: text,
    steps: factorFound || xPower > 0
      ? ['提取公因式并按平方差、完全平方或可分解三项式整理']
      : ['当前式不能在“提公因式、平方差、完全平方”范围内进一步分解']
  }
}

function collectDenominatorPolynomials(node, result) {
  const list = result || []
  if (!node) {
    return list
  }
  if (node.type === 'equation' || node.type === 'inequality') {
    collectDenominatorPolynomials(node.left, list)
    collectDenominatorPolynomials(node.right, list)
  } else if (node.type === 'binary') {
    if (node.operator === '/') {
      const denominator = parser.expressionToPolynomial(node.right)
      list.push(denominator)
    }
    collectDenominatorPolynomials(node.left, list)
    collectDenominatorPolynomials(node.right, list)
  } else if (node.type === 'unary') {
    collectDenominatorPolynomials(node.value, list)
  } else if (node.type === 'call') {
    collectDenominatorPolynomials(node.argument, list)
  }
  return list
}

function domainFromNode(node) {
  let denominators
  try {
    denominators = collectDenominatorPolynomials(node, [])
  } catch (error) {
    return ''
  }
  const roots = []
  const variables = []
  for (let index = 0; index < denominators.length; index += 1) {
    const polynomial = denominators[index]
    if (polynomial.degree() <= 0) {
      continue
    }
    if (variables.indexOf(polynomial.variableName) < 0) {
      variables.push(polynomial.variableName)
    }
    try {
      const solved = polynomialRealRoots(polynomial)
      if (solved.type === 'real') {
        for (let rootIndex = 0; rootIndex < solved.roots.length; rootIndex += 1) {
          const text = solved.roots[rootIndex].toString()
          roots.push(text)
        }
      }
    } catch (error) {
      roots.push('使分母为 0 的值')
    }
  }
  const unique = roots.filter(function (value, index) {
    return roots.indexOf(value) === index
  })
  return unique.length ? (variables[0] || 'x') + ' ≠ ' + unique.join('，') : ''
}

function simplifyPolynomialExpression(text) {
  try {
    const ast = parser.parseExpression(text)
    const rational = parser.expressionToRational(ast)
    if (!rational.isPolynomial()) {
      return simplifyRationalExpressionAst(ast)
    }
    const polynomial = rational.numerator
    ensureDegree(polynomial, 6, '展开后的多项式')
    if (polynomialCoefficientBounds(polynomial) > 100000000) {
      throw new Error('计算结果过大')
    }
    return successResult('expression', [polynomial.toString()], [
      '按乘法分配律展开',
      '合并同类项并整理为降幂形式'
    ], {
      title: '化简结果',
      domain: ''
    })
  } catch (error) {
    return errorResult(error.message, 'expression')
  }
}

function factorExpression(text) {
  try {
    const ast = parser.parseExpression(text)
    const polynomial = parser.expressionToPolynomial(ast)
    ensureDegree(polynomial, 6, '待分解多项式')
    const factored = factorPolynomial(polynomial)
    if (!factored.ok) {
      return successResult('factor', ['原式：' + polynomial.toString()], factored.steps, {
        title: '因式分解'
      })
    }
    return successResult('factor', [factored.text], factored.steps, {
      title: '因式分解'
    })
  } catch (error) {
    return errorResult(error.message, 'factor')
  }
}

function simplifyRationalExpressionAst(ast) {
  const rational = parser.expressionToRational(ast)
  const domain = domainFromNode(ast)
  const steps = [
    '分别整理分子与分母',
    '约去公因式，并把分母首项系数化为正'
  ]
  if (domain) {
    steps.push('保留原式定义域限制：' + domain)
  }
  return successResult('rational-expression', [rational.toString()], steps, {
    title: '分式化简结果',
    domain: domain
  })
}

function simplifyRationalExpression(text) {
  try {
    const ast = parser.parseExpression(text)
    return simplifyRationalExpressionAst(ast)
  } catch (error) {
    return errorResult(error.message, 'rational-expression')
  }
}

function normalizeInequalityOperator(operator) {
  return operator === '<' ? '<' : (operator === '<=' ? '<=' : (operator === '>' ? '>' : '>='))
}

function reverseOperator(operator) {
  if (operator === '<') {
    return '>'
  }
  if (operator === '<=') {
    return '>='
  }
  if (operator === '>') {
    return '<'
  }
  return '<='
}

function inequalityToBound(text) {
  const relation = parser.parseRelation(text)
  if (relation.type !== 'inequality') {
    throw new Error('此处需要不等式')
  }
  const left = parser.expressionToLinearXY(relation.left)
  const right = parser.expressionToLinearXY(relation.right)
  const a = left.x.sub(right.x)
  const y = left.y.sub(right.y)
  const c = left.c.sub(right.c)
  if (!y.isZero()) {
    throw new Error('不等式当前只支持一个未知数 x')
  }
  const operator = normalizeInequalityOperator(relation.operator)
  if (a.isZero()) {
    const holds = compareRelation(c, ZERO, operator)
    if (!holds) {
      throw new Error('不等式恒不成立')
    }
    return { always: true }
  }
  let boundOperator = operator
  const bound = c.neg().div(a)
  if (a.sign() < 0) {
    boundOperator = reverseOperator(boundOperator)
  }
  return { bound: bound, operator: boundOperator }
}

function compareRelation(left, right, operator) {
  const comparison = Fraction.from(left).compare(right)
  if (operator === '<') {
    return comparison < 0
  }
  if (operator === '<=') {
    return comparison <= 0
  }
  if (operator === '>') {
    return comparison > 0
  }
  return comparison >= 0
}

function intervalFromBounds(lower, upper) {
  if (lower && upper) {
    if (lower.value.compare(upper.value) > 0) {
      return '无解'
    }
    if (lower.value.equals(upper.value)) {
      return lower.inclusive && upper.inclusive ? 'x = ' + lower.value.toString() : '无解'
    }
    return lower.value.toString() + ' ' + (lower.inclusive ? '≤' : '<') +
      ' x ' + (upper.inclusive ? '≤' : '<') + ' ' + upper.value.toString()
  }
  if (lower) {
    return 'x ' + (lower.inclusive ? '≥' : '>') + ' ' + lower.value.toString()
  }
  if (upper) {
    return 'x ' + (upper.inclusive ? '≤' : '<') + ' ' + upper.value.toString()
  }
  return '全体实数'
}

function inequalityHolds(value, operator) {
  if (operator === '<') {
    return value < -1e-10
  }
  if (operator === '<=') {
    return value <= 1e-10
  }
  if (operator === '>') {
    return value > 1e-10
  }
  return value >= -1e-10
}

function evaluatePolynomialNumber(polynomial, value) {
  let result = 0
  const degree = polynomial.degree()
  for (let current = 0; current <= degree; current += 1) {
    const coefficient = polynomial.coefficient(current)
    result += coefficient.toNumber() * Math.pow(value, current)
  }
  return result
}

function endpointCompare(left, right) {
  if (!left && !right) {
    return 0
  }
  if (!left) {
    return -1
  }
  if (!right) {
    return 1
  }
  const difference = left.value.toNumber() - right.value.toNumber()
  if (Math.abs(difference) < 1e-9) {
    return 0
  }
  return difference < 0 ? -1 : 1
}

function higherLower(left, right) {
  if (!left) return right
  if (!right) return left
  const comparison = endpointCompare(left, right)
  if (comparison > 0) return left
  if (comparison < 0) return right
  return { value: left.value, inclusive: left.inclusive && right.inclusive }
}

function lowerUpper(left, right) {
  if (!left) return right
  if (!right) return left
  const comparison = endpointCompare(left, right)
  if (comparison < 0) return left
  if (comparison > 0) return right
  return { value: left.value, inclusive: left.inclusive && right.inclusive }
}

function intersectIntervalSets(left, right) {
  const result = []
  for (let i = 0; i < left.length; i += 1) {
    for (let j = 0; j < right.length; j += 1) {
      const lower = higherLower(left[i].lower, right[j].lower)
      const upper = lowerUpper(left[i].upper, right[j].upper)
      if (lower && upper) {
        const comparison = endpointCompare(lower, upper)
        if (comparison > 0) {
          continue
        }
        if (comparison === 0 && !(lower.inclusive && upper.inclusive)) {
          continue
        }
      }
      result.push({ lower: lower, upper: upper })
    }
  }
  return mergeIntervals(result)
}

function mergeIntervals(intervals) {
  const sorted = intervals.slice().sort(function (left, right) {
    return endpointCompare(left.lower, right.lower)
  })
  const result = []
  for (let index = 0; index < sorted.length; index += 1) {
    const next = sorted[index]
    if (!result.length) {
      result.push(next)
      continue
    }
    const current = result[result.length - 1]
    if (!current.upper) {
      continue
    }
    if (!next.lower) {
      result[result.length - 1] = { lower: null, upper: next.upper }
      continue
    }
    const comparison = endpointCompare(current.upper, next.lower)
    const touching = comparison === 0 && current.upper.inclusive && next.lower.inclusive
    if (comparison > 0 || touching) {
      if (!next.upper) {
        current.upper = null
      } else if (endpointCompare(next.upper, current.upper) > 0) {
        current.upper = next.upper
      }
    } else {
      result.push(next)
    }
  }
  return result
}

function formatIntervalSet(intervals, variableName) {
  return intervals.map(function (interval) {
    if (!interval.lower && !interval.upper) {
      return '全体实数'
    }
    if (interval.lower && interval.upper &&
      endpointCompare(interval.lower, interval.upper) === 0) {
      return variableName + ' = ' + interval.lower.value.toString()
    }
    if (interval.lower && interval.upper) {
      return interval.lower.value.toString() + ' ' +
        (interval.lower.inclusive ? '≤' : '<') + ' ' + variableName + ' ' +
        (interval.upper.inclusive ? '≤' : '<') + ' ' + interval.upper.value.toString()
    }
    if (interval.lower) {
      return variableName + ' ' + (interval.lower.inclusive ? '≥' : '>') +
        ' ' + interval.lower.value.toString()
    }
    return variableName + ' ' + (interval.upper.inclusive ? '≤' : '<') +
      ' ' + interval.upper.value.toString()
  }).join(' 或 ')
}

function solveOnePolynomialInequality(text) {
  const relation = parser.parseRelation(text)
  if (relation.type !== 'inequality') {
    throw new Error('不等式组中只能包含不等式')
  }
  let left
  let right
  try {
    left = parser.expressionToPolynomial(relation.left)
    right = parser.expressionToPolynomial(relation.right)
  } catch (error) {
    if (error.message.indexOf('字母分母') >= 0) {
      throw new Error('不等式组当前支持整式分母为常数；含未知数分母的分式不等式暂不支持')
    }
    throw error
  }
  const polynomial = left.sub(right)
  ensureDegree(polynomial, 2, '不等式中的多项式')
  const operator = normalizeInequalityOperator(relation.operator)
  const variableName = polynomial.variableName || 'x'
  const degree = polynomial.degree()
  const zeroIncluded = operator === '<=' || operator === '>='

  if (degree <= 0) {
    const value = polynomial.coefficient(0).toNumber()
    return {
      variableName: variableName,
      intervals: inequalityHolds(value, operator)
        ? [{ lower: null, upper: null }]
        : [],
      polynomial: polynomial,
      operator: operator
    }
  }

  const solved = polynomialRealRoots(polynomial)
  const roots = []
  if (solved.type === 'real') {
    const rootMap = {}
    for (let index = 0; index < solved.roots.length; index += 1) {
      const key = solved.roots[index].toNumber().toFixed(10)
      if (!rootMap[key]) {
        rootMap[key] = true
        roots.push(solved.roots[index])
      }
    }
    roots.sort(function (a, b) {
      return a.toNumber() - b.toNumber()
    })
  }

  const interval = function (lower, lowerInclusive, upper, upperInclusive) {
    return {
      lower: lower === null ? null : { value: lower, inclusive: lowerInclusive },
      upper: upper === null ? null : { value: upper, inclusive: upperInclusive }
    }
  }
  const candidates = []
  if (!roots.length) {
    candidates.push(interval(null, false, null, false))
  } else if (roots.length === 1) {
    candidates.push(interval(null, false, roots[0], zeroIncluded))
    if (zeroIncluded) {
      candidates.push(interval(roots[0], true, roots[0], true))
    }
    candidates.push(interval(roots[0], zeroIncluded, null, false))
  } else {
    candidates.push(interval(null, false, roots[0], zeroIncluded))
    candidates.push(interval(roots[0], zeroIncluded, roots[1], zeroIncluded))
    candidates.push(interval(roots[1], zeroIncluded, null, false))
  }

  const accepted = candidates.filter(function (candidate) {
    if (candidate.lower && candidate.upper &&
      endpointCompare(candidate.lower, candidate.upper) === 0) {
      const value = evaluatePolynomialRadical(polynomial, candidate.lower.value).toNumber()
      return inequalityHolds(value, operator)
    }
    let sample
    if (!candidate.lower) {
      const upper = candidate.upper.value.toNumber()
      sample = upper - Math.max(1, Math.abs(upper) * 0.5 + 1)
    } else if (!candidate.upper) {
      const lower = candidate.lower.value.toNumber()
      sample = lower + Math.max(1, Math.abs(lower) * 0.5 + 1)
    } else {
      sample = (candidate.lower.value.toNumber() + candidate.upper.value.toNumber()) / 2
    }
    return inequalityHolds(evaluatePolynomialNumber(polynomial, sample), operator)
  })
  return {
    variableName: variableName,
    intervals: mergeIntervals(accepted),
    polynomial: polynomial,
    operator: operator
  }
}

function solveInequalities(inputs) {
  let solution = [{ lower: null, upper: null }]
  const steps = []
  let variableName = 'x'
  try {
    for (let index = 0; index < inputs.length; index += 1) {
      if (!String(inputs[index] || '').trim()) {
        continue
      }
      const part = solveOnePolynomialInequality(inputs[index])
      if (index === 0) {
        variableName = part.variableName
      } else if (variableName !== part.variableName) {
        throw new Error('不等式组中的未知数必须一致')
      }
      steps.push('第 ' + (index + 1) + ' 个不等式整理为：' +
        part.polynomial.toString() + ' ' + part.operator + ' 0')
      solution = intersectIntervalSets(solution, part.intervals)
    }
    if (!solution.length) {
      return successResult('inequality', ['无解'], steps.concat(['各不等式解集没有公共部分']), {
        title: '不等式组解集'
      })
    }
    return successResult('inequality', [formatIntervalSet(solution, variableName)], steps.concat([
      '分别求每个一元一次或一元二次不等式',
      '取各解集的交集'
    ]), {
      title: '不等式组解集'
    })
  } catch (error) {
    return errorResult(error.message, 'inequality')
  }
}

function relationsFromInputs(inputs) {
  const list = []
  for (let index = 0; index < inputs.length; index += 1) {
    const text = String(inputs[index] || '').trim()
    if (!text) {
      continue
    }
    const parts = parser.splitTopLevel(text, ',;')
    for (let partIndex = 0; partIndex < parts.length; partIndex += 1) {
      list.push(parts[partIndex])
    }
  }
  return list
}

function rationalEquationRoots(text) {
  const relation = parser.parseRelation(text)
  if (relation.type !== 'equation') {
    throw new Error('此处需要等式')
  }
  const left = parser.expressionToRational(relation.left)
  const right = parser.expressionToRational(relation.right)
  const difference = left.sub(right)
  ensureDegree(difference.numerator, 2, '方程')
  ensureDegree(difference.denominator, 2, '分母')
  const domain = domainFromNode({
    type: 'binary',
    operator: '/',
    left: { type: 'number', value: '0' },
    right: relation.left
  })
  return {
    difference: difference,
    solved: polynomialRealRoots(difference.numerator),
    domain: domain
  }
}

function solveEquation(text) {
  try {
    const relation = parser.parseRelation(text)
    if (relation.type !== 'equation') {
      throw new Error('此处需要等式')
    }
    const left = parser.expressionToRational(relation.left)
    const right = parser.expressionToRational(relation.right)
    const difference = left.sub(right)
    ensureDegree(difference.numerator, 2, '方程')
    const solved = polynomialRealRoots(difference.numerator)
    if (solved.type === 'all') {
      return successResult('equation', ['全体实数'], [
        '移项后两边恒等',
        '原方程是恒等式'
      ], { title: '方程解' })
    }
    if (solved.type === 'none') {
      return successResult('equation', ['无解'], [
        '移项后得到 0 = 非零常数',
        '原方程没有实数解'
      ], { title: '方程解' })
    }
    if (solved.type === 'complex') {
      return successResult('equation', ['无实数解'], [
        '整理后计算判别式 Δ = ' + solved.discriminant.toString(),
        '因为 Δ < 0，所以方程没有实数解'
      ], { title: '方程解' })
    }
    const variableName = difference.numerator.variableName || 'x'
    const exact = solved.roots.map(function (root, index) {
      return variableName + (solved.roots.length > 1 ? (index + 1) : '') + ' = ' + root.toString()
    })
    const approximate = solved.roots.map(function (root) {
      return '≈ ' + Number(root.toNumber().toFixed(2))
    })
    return successResult('equation', exact, [
      '移项并使一边为 0',
      '按一次或二次方程的方法求出实数根',
      '代回原方程检验'
    ], {
      title: '方程解',
      approximate: approximate
    })
  } catch (error) {
    return errorResult(error.message, 'equation')
  }
}

function solveRationalEquation(text) {
  try {
    const relation = parser.parseRelation(text)
    if (relation.type !== 'equation') {
      throw new Error('此处需要等式')
    }
    const left = parser.expressionToRational(relation.left)
    const right = parser.expressionToRational(relation.right)
    const difference = left.sub(right)
    ensureDegree(difference.numerator, 2, '整理后的方程')
    const solved = polynomialRealRoots(difference.numerator)
    const domain = domainFromNode(relation)
    if (solved.type !== 'real') {
      return successResult('rational-equation', ['无实数解'], [
        '整理并求出候选根',
        '候选根中没有落在定义域内的值'
      ], { title: '分式方程解', domain: domain })
    }
    const roots = solved.roots
    const denominators = collectDenominatorPolynomials(relation, [])
    const accepted = []
    const rejected = []
    for (let index = 0; index < roots.length; index += 1) {
      let valid = true
      for (let denominatorIndex = 0; denominatorIndex < denominators.length; denominatorIndex += 1) {
        try {
          const denominatorValue = evaluatePolynomialRadical(denominators[denominatorIndex], roots[index])
          if (denominatorValue.isZero()) {
            valid = false
          }
        } catch (error) {
          valid = false
        }
      }
      if (valid) {
        accepted.push(roots[index])
      } else {
        rejected.push(roots[index])
      }
    }
    if (!accepted.length) {
      return successResult('rational-equation', ['无解'], [
        '去分母后得到的根都是增根',
        '增根：' + rejected.map(function (root) { return 'x=' + root.toString() }).join('，')
      ], { title: '分式方程解', domain: domain })
    }
    const variableName = difference.numerator.variableName || 'x'
    const exact = accepted.map(function (root, index) {
      return variableName + (accepted.length > 1 ? (index + 1) : '') + ' = ' + root.toString()
    })
    const steps = ['确定分母不为 0', '去分母并解整理后的整式方程']
    if (rejected.length) {
      steps.push('舍去增根：' + rejected.map(function (root) { return 'x=' + root.toString() }).join('，'))
    }
    return successResult('rational-equation', exact, steps, {
      title: '分式方程解',
      domain: domain,
      approximate: accepted.map(function (root) {
        return '≈ ' + Number(root.toNumber().toFixed(2))
      })
    })
  } catch (error) {
    return errorResult(error.message, 'rational-equation')
  }
}

function solveLinearSystem(inputs) {
  try {
    const relations = relationsFromInputs(inputs)
    if (relations.length !== 2) {
      throw new Error('二元一次方程组需要恰好两个等式')
    }
    const equations = []
    for (let index = 0; index < relations.length; index += 1) {
      const relation = parser.parseRelation(relations[index])
      if (relation.type !== 'equation') {
        throw new Error('方程组中只能包含等式')
      }
      const left = parser.expressionToLinearXY(relation.left)
      const right = parser.expressionToLinearXY(relation.right)
      equations.push({
        a: left.x.sub(right.x),
        b: left.y.sub(right.y),
        c: right.c.sub(left.c)
      })
    }
    const determinant = equations[0].a.mul(equations[1].b).sub(
      equations[0].b.mul(equations[1].a)
    )
    if (determinant.isZero()) {
      const upper = equations[0].a.mul(equations[1].c).sub(
        equations[0].c.mul(equations[1].a)
      )
      const lower = equations[0].b.mul(equations[1].c).sub(
        equations[0].c.mul(equations[1].b)
      )
      if (upper.isZero() && lower.isZero()) {
        return successResult('system', ['无穷多组解'], [
          '两个方程化简后表示同一条直线',
          '方程组有无穷多组解'
        ], { title: '二元一次方程组' })
      }
      return successResult('system', ['无解'], [
        '系数行列式为 0，且方程不相容',
        '两条直线平行，方程组无解'
      ], { title: '二元一次方程组' })
    }
    const x = equations[0].c.mul(equations[1].b).sub(
      equations[0].b.mul(equations[1].c)
    ).div(determinant)
    const y = equations[0].a.mul(equations[1].c).sub(
      equations[0].c.mul(equations[1].a)
    ).div(determinant)
    return successResult('system',
      ['x = ' + x.toString(), 'y = ' + y.toString()],
      ['整理为标准形式 a₁x+b₁y=c₁、a₂x+b₂y=c₂', '使用消元法或行列式求出唯一解'], {
        title: '二元一次方程组',
        approximate: ['x ≈ ' + approximateFraction(x), 'y ≈ ' + approximateFraction(y)]
      })
  } catch (error) {
    return errorResult(error.message, 'system')
  }
}

function stripFunctionPrefix(text) {
  let source = String(text || '').trim()
  if (/^f\s*\(\s*x\s*\)\s*=/i.test(source)) {
    return source.replace(/^f\s*\(\s*x\s*\)\s*=/i, '').trim()
  }
  if (/^y\s*=/i.test(source)) {
    return source.replace(/^y\s*=/i, '').trim()
  }
  if (source.indexOf('=') >= 0) {
    const parts = source.split('=')
    if (parts.length === 2 && /^\s*y\s*$/i.test(parts[0])) {
      return parts[1].trim()
    }
    throw new Error('函数请输入 y=…、f(x)=… 或只输入右侧表达式')
  }
  return source
}

function analyzeLinearFunction(text) {
  try {
    const source = stripFunctionPrefix(text)
    const polynomial = parser.expressionToPolynomial(parser.parseExpression(source))
    ensureDegree(polynomial, 1, '一次函数')
    const k = polynomial.coefficient(1)
    const b = polynomial.coefficient(0)
    const trend = k.isZero() ? '水平直线' : (k.sign() > 0 ? 'y 随 x 增大而增大' : 'y 随 x 增大而减小')
    const exact = [
      'y = ' + polynomial.toString(),
      'k = ' + k.toString() + '，b = ' + b.toString(),
      trend,
      '定义域：全体实数'
    ]
    return successResult('linear-function', exact, [
      '把表达式整理为 y = kx + b',
      k.isZero() ? 'k=0，函数值保持不变' : 'k 决定直线的上升或下降'
    ], {
      title: '一次函数',
      domain: '全体实数',
      graph: graphs.buildLinearGraph(k.toNumber(), b.toNumber()),
      approximate: ['b ≈ ' + approximateFraction(b)]
    })
  } catch (error) {
    return errorResult(error.message, 'linear-function')
  }
}

function analyzeInverseFunction(text) {
  try {
    const source = stripFunctionPrefix(text)
    const rational = parser.expressionToRational(parser.parseExpression(source))
    if (rational.numerator.degree() !== 0 ||
      rational.denominator.degree() !== 1 ||
      !rational.denominator.coefficient(0).isZero()) {
      throw new Error('反比例函数应整理为 y = k/x 的形式')
    }
    const k = rational.numerator.coefficient(0).div(rational.denominator.coefficient(1))
    if (k.isZero()) {
      throw new Error('反比例函数的比例系数 k 不能为 0')
    }
    const quadrants = k.sign() > 0 ? '第一、第三象限' : '第二、第四象限'
    return successResult('inverse-function', [
      'y = ' + k.toString() + '/x',
      'k = ' + k.toString(),
      '图像位于' + quadrants,
      '渐近线：x = 0，y = 0'
    ], [
      '确认表达式可以写成 y = k/x',
      'k 的符号决定双曲线所在象限'
    ], {
      title: '反比例函数',
      domain: 'x ≠ 0',
      graph: graphs.buildInverseGraph(k.toNumber()),
      approximate: ['k ≈ ' + approximateFraction(k)]
    })
  } catch (error) {
    return errorResult(error.message, 'inverse-function')
  }
}

function quadraticVertex(polynomial) {
  const a = polynomial.coefficient(2)
  const b = polynomial.coefficient(1)
  const c = polynomial.coefficient(0)
  const x = b.neg().div(new Fraction(2, 1).mul(a))
  const y = polynomial.evaluate(x)
  return { x: x, y: y, a: a, b: b, c: c }
}

function formatVertexForm(a, h, k, variableName) {
  const name = variableName || 'x'
  const coefficient = a.isOne() ? '' : (a.equals(ONE.neg()) ? '-' : a.toString())
  const xPart = h.isZero()
    ? name + '²'
    : (h.sign() > 0
      ? '(' + name + ' - ' + h.toString() + ')²'
      : '(' + name + ' + ' + h.abs().toString() + ')²')
  let output = coefficient + xPart
  if (!k.isZero()) {
    output += k.sign() > 0 ? ' + ' + k.toString() : ' - ' + k.abs().toString()
  }
  return 'y = ' + output
}

function formatFactoredQuadratic(a, roots, variableName) {
  const pieces = []
  if (!a.isOne()) {
    pieces.push(a.toString())
  }
  pieces.push(formatLinearFactor(roots[0], variableName))
  if (roots[0].toString() !== roots[1].toString()) {
    pieces.push(formatLinearFactor(roots[1], variableName))
  } else {
    pieces[pieces.length - 1] = pieces[pieces.length - 1] + '²'
  }
  return 'y = ' + pieces.join('')
}

function analyzeQuadraticFunction(text) {
  try {
    const source = stripFunctionPrefix(text)
    const polynomial = parser.expressionToPolynomial(parser.parseExpression(source))
    if (polynomial.degree() !== 2) {
      throw new Error('二次函数必须含 x² 项，且二次项系数不能为 0')
    }
    const vertex = quadraticVertex(polynomial)
    const roots = polynomialRealRoots(polynomial)
    const general = 'y = ' + polynomial.toString()
    const vertexForm = formatVertexForm(vertex.a, vertex.x, vertex.y, polynomial.variableName)
    const exact = [general, vertexForm]
    let graphRoots = []
    if (roots.type === 'real') {
      exact.push(formatFactoredQuadratic(vertex.a, roots.roots, polynomial.variableName))
      graphRoots = roots.roots.map(function (root) {
        return root.toNumber()
      })
    } else {
      exact.push('交点式：无实根，图像与 x 轴无交点')
    }
    exact.push('顶点：(' + vertex.x.toString() + ', ' + vertex.y.toString() + ')')
    const graph = graphs.buildQuadraticGraph(
      vertex.a.toNumber(),
      vertex.b.toNumber(),
      vertex.c.toNumber(),
      { x: vertex.x.toNumber(), y: vertex.y.toNumber() },
      graphRoots
    )
    return successResult('quadratic-function', exact, [
      '展开并整理为一般式 y=ax²+bx+c',
      '用顶点横坐标 x=-b/(2a) 求顶点',
      '根据判别式判断图像与 x 轴的交点'
    ], {
      title: '二次函数',
      domain: '全体实数',
      graph: graph,
      approximate: [
        '顶点横坐标 ≈ ' + approximateFraction(vertex.x),
        '顶点纵坐标 ≈ ' + approximateFraction(vertex.y)
      ]
    })
  } catch (error) {
    return errorResult(error.message, 'quadratic-function')
  }
}

function run(moduleId, modeId, lines) {
  const inputs = (lines || []).map(function (line) {
    return String(line || '').trim()
  })
  const first = inputs[0] || ''
  const hasAny = inputs.some(function (line) { return Boolean(line) })
  if (!hasAny) {
    return errorResult('请输入内容', modeId)
  }
  try {
    if (moduleId === 'polynomial' && modeId === 'simplify') {
      return simplifyPolynomialExpression(first)
    }
    if (moduleId === 'polynomial' && modeId === 'factor') {
      return factorExpression(first)
    }
    if (moduleId === 'rational' && modeId === 'simplify') {
      return simplifyRationalExpression(first)
    }
    if (moduleId === 'rational' && modeId === 'solve') {
      return solveRationalEquation(first)
    }
    if (moduleId === 'equations' && modeId === 'linear') {
      return solveEquation(first)
    }
    if (moduleId === 'equations' && modeId === 'quadratic') {
      return solveEquation(first)
    }
    if (moduleId === 'equations' && modeId === 'rational') {
      return solveRationalEquation(first)
    }
    if (moduleId === 'equations' && modeId === 'system') {
      return solveLinearSystem(inputs)
    }
    if (moduleId === 'equations' && modeId === 'inequality') {
      return solveInequalities(inputs)
    }
    if (moduleId === 'radical') {
      const ast = parser.parseExpression(first)
      const value = parser.expressionToRadical(ast)
      return successResult('radical', [value.toString()], [
        '把各根式化为最简二次根式',
        '合并同类根式并完成乘除运算'
      ], {
        title: '二次根式结果',
        approximate: ['≈ ' + Number(value.toNumber().toFixed(2))]
      })
    }
    if (moduleId === 'linear') {
      return analyzeLinearFunction(first)
    }
    if (moduleId === 'inverse') {
      return analyzeInverseFunction(first)
    }
    if (moduleId === 'quadratic') {
      return analyzeQuadraticFunction(first)
    }
    return errorResult('暂不支持该计算类型', 'unsupported')
  } catch (error) {
    return errorResult(error.message, modeId)
  }
}

module.exports = {
  run: run,
  simplifyPolynomialExpression: simplifyPolynomialExpression,
  factorExpression: factorExpression,
  simplifyRationalExpression: simplifyRationalExpression,
  solveEquation: solveEquation,
  solveRationalEquation: solveRationalEquation,
  solveLinearSystem: solveLinearSystem,
  solveInequalities: solveInequalities,
  analyzeLinearFunction: analyzeLinearFunction,
  analyzeInverseFunction: analyzeInverseFunction,
  analyzeQuadraticFunction: analyzeQuadraticFunction,
  factorPolynomial: factorPolynomial,
  polynomialRealRoots: polynomialRealRoots
}
