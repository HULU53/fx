'use strict'

const Fraction = require('./fraction').Fraction
const ZERO = require('./fraction').ZERO
const ONE = require('./fraction').ONE

function cleanCoefficient(value) {
  return Fraction.from(value)
}

class Polynomial {
  constructor(coefficients, variableName) {
    this.coefficients = {}
    this.variableName = variableName || 'x'
    const source = coefficients || {}
    const keys = Object.keys(source)
    for (let index = 0; index < keys.length; index += 1) {
      const degree = Number(keys[index])
      const coefficient = cleanCoefficient(source[keys[index]])
      if (degree >= 0 && Number.isInteger(degree) && !coefficient.isZero()) {
        this.coefficients[degree] = coefficient
      }
    }
  }

  clone() {
    return new Polynomial(this.coefficients, this.variableName)
  }

  degree() {
    const keys = Object.keys(this.coefficients)
    let degree = -1
    for (let index = 0; index < keys.length; index += 1) {
      degree = Math.max(degree, Number(keys[index]))
    }
    return degree
  }

  coefficient(degree) {
    return this.coefficients[degree] || ZERO
  }

  isZero() {
    return this.degree() < 0
  }

  add(other) {
    const value = Polynomial.from(other)
    const result = new Polynomial(this.coefficients, resolveVariable(this, value))
    const keys = Object.keys(value.coefficients)
    for (let index = 0; index < keys.length; index += 1) {
      const degree = keys[index]
      result.coefficients[degree] = result.coefficient(degree).add(value.coefficient(degree))
      if (result.coefficients[degree].isZero()) {
        delete result.coefficients[degree]
      }
    }
    return result
  }

  sub(other) {
    return this.add(Polynomial.from(other).neg())
  }

  neg() {
    const result = new Polynomial({}, this.variableName)
    const keys = Object.keys(this.coefficients)
    for (let index = 0; index < keys.length; index += 1) {
      result.coefficients[keys[index]] = this.coefficients[keys[index]].neg()
    }
    return result
  }

  mul(other) {
    const value = Polynomial.from(other)
    const result = {}
    const variableName = resolveVariable(this, value)
    const leftKeys = Object.keys(this.coefficients)
    const rightKeys = Object.keys(value.coefficients)
    for (let i = 0; i < leftKeys.length; i += 1) {
      for (let j = 0; j < rightKeys.length; j += 1) {
        const degree = Number(leftKeys[i]) + Number(rightKeys[j])
        const coefficient = this.coefficients[leftKeys[i]].mul(value.coefficients[rightKeys[j]])
        const previous = result[degree] || ZERO
        const sum = previous.add(coefficient)
        if (sum.isZero()) {
          delete result[degree]
        } else {
          result[degree] = sum
        }
      }
    }
    return new Polynomial(result, variableName)
  }

  scale(value) {
    return this.mul(Polynomial.constant(value, this.variableName))
  }

  pow(exponent) {
    const power = Number(exponent)
    if (!Number.isInteger(power) || power < 0) {
      throw new Error('多项式指数必须是非负整数')
    }
    let result = Polynomial.constant(ONE, this.variableName)
    let base = this
    let count = power
    while (count > 0) {
      if (count % 2 === 1) {
        result = result.mul(base)
      }
      count = Math.floor(count / 2)
      if (count) {
        base = base.mul(base)
      }
    }
    return result
  }

  divRem(divisor) {
    const denominator = Polynomial.from(divisor)
    if (denominator.isZero()) {
      throw new Error('除式不能为 0')
    }
    let remainder = this.clone()
    const quotient = {}
    const divisorDegree = denominator.degree()
    const divisorLead = denominator.coefficient(divisorDegree)
    let guard = 0
    while (!remainder.isZero() && remainder.degree() >= divisorDegree) {
      guard += 1
      if (guard > 200) {
        throw new Error('多项式运算过于复杂')
      }
      const degree = remainder.degree() - divisorDegree
      const coefficient = remainder.coefficient(remainder.degree()).div(divisorLead)
      quotient[degree] = (quotient[degree] || ZERO).add(coefficient)
      remainder = remainder.sub(denominator.mul(Polynomial.monomial(coefficient, degree, this.variableName)))
    }
    return {
      quotient: new Polynomial(quotient, this.variableName),
      remainder: remainder
    }
  }

  div(other) {
    const result = this.divRem(other)
    if (!result.remainder.isZero()) {
      throw new Error('整式不能整除')
    }
    return result.quotient
  }

  evaluate(value) {
    const x = Fraction.from(value)
    let result = ZERO
    const keys = Object.keys(this.coefficients)
    for (let index = 0; index < keys.length; index += 1) {
      result = result.add(this.coefficients[keys[index]].mul(x.pow(Number(keys[index]))))
    }
    return result
  }

  equals(other) {
    const value = Polynomial.from(other)
    const keys = Object.keys(this.coefficients)
    if (keys.length !== Object.keys(value.coefficients).length) {
      return false
    }
    for (let index = 0; index < keys.length; index += 1) {
      if (!this.coefficients[keys[index]].equals(value.coefficient(Number(keys[index])))) {
        return false
      }
    }
    return true
  }

  toString() {
    const degree = this.degree()
    if (degree < 0) {
      return '0'
    }
    const chunks = []
    for (let current = degree; current >= 0; current -= 1) {
      const coefficient = this.coefficient(current)
      if (coefficient.isZero()) {
        continue
      }
      const sign = coefficient.sign() < 0 ? '-' : '+'
      let absolute = coefficient.abs()
      let body = ''
      if (!absolute.isOne() || current === 0) {
        body += absolute.toString()
      }
      if (current > 0) {
        body += this.variableName
        if (current > 1) {
          body += formatExponent(current)
        }
      }
      chunks.push({ sign: sign, body: body })
    }
    let output = ''
    for (let index = 0; index < chunks.length; index += 1) {
      const item = chunks[index]
      if (index === 0) {
        output += item.sign === '-' ? '-' : ''
      } else {
        output += ' ' + item.sign + ' '
      }
      output += item.body
    }
    return output || '0'
  }

  static from(value) {
    if (value instanceof Polynomial) {
      return value
    }
    if (typeof value === 'number' || typeof value === 'string') {
      return Polynomial.constant(value)
    }
    if (value && value.coefficients) {
      return new Polynomial(value.coefficients, value.variableName || 'x')
    }
    throw new Error('无法转换为多项式')
  }

  static constant(value, variableName) {
    return new Polynomial({ 0: value }, variableName || 'x')
  }

  static monomial(coefficient, degree, variableName) {
    return new Polynomial({ [degree]: coefficient }, variableName || 'x')
  }

  static fromRoots(roots, scale, variableName) {
    const name = variableName || 'x'
    let result = Polynomial.constant(scale || ONE, name)
    for (let index = 0; index < roots.length; index += 1) {
      result = result.mul(new Polynomial({
        1: ONE,
        0: Fraction.from(roots[index]).neg()
      }, name))
    }
    return result
  }
}

Polynomial.ZERO = new Polynomial({})
Polynomial.ONE = Polynomial.constant(ONE)
Polynomial.X = new Polynomial({ 1: ONE })

function formatExponent(value) {
  const superscripts = {
    0: '⁰',
    1: '¹',
    2: '²',
    3: '³',
    4: '⁴',
    5: '⁵',
    6: '⁶',
    7: '⁷',
    8: '⁸',
    9: '⁹'
  }
  return String(value).split('').map(function (digit) {
    return superscripts[digit] || digit
  }).join('')
}

function resolveVariable(left, right) {
  const leftPolynomial = Polynomial.from(left)
  const rightPolynomial = Polynomial.from(right)
  const leftConstant = leftPolynomial.degree() <= 0
  const rightConstant = rightPolynomial.degree() <= 0
  if (leftConstant && !rightConstant) {
    return rightPolynomial.variableName
  }
  if (rightConstant && !leftConstant) {
    return leftPolynomial.variableName
  }
  if (!leftConstant && !rightConstant &&
    leftPolynomial.variableName !== rightPolynomial.variableName) {
    throw new Error('同一次计算只能使用一个字母未知数')
  }
  return leftPolynomial.variableName || rightPolynomial.variableName || 'x'
}

function polynomialGcd(left, right) {
  let a = Polynomial.from(left)
  let b = Polynomial.from(right)
  let guard = 0
  while (!b.isZero()) {
    guard += 1
    if (guard > 100) {
      throw new Error('多项式约分过于复杂')
    }
    const remainder = a.divRem(b).remainder
    a = b
    b = remainder
  }
  if (a.isZero()) {
    return a
  }
  const lead = a.coefficient(a.degree())
  return a.scale(lead.inv())
}

function hasVariable(polynomial) {
  return Polynomial.from(polynomial).degree() > 0
}

module.exports = {
  Polynomial: Polynomial,
  polynomialGcd: polynomialGcd,
  hasVariable: hasVariable,
  formatExponent: formatExponent
}
