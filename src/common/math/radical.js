'use strict'

const Fraction = require('./fraction').Fraction
const ZERO = require('./fraction').ZERO
const ONE = require('./fraction').ONE
const isPerfectSquareInteger = require('./fraction').isPerfectSquareInteger

function squareFreeInteger(value) {
  let number = Math.abs(Math.trunc(value))
  let outside = 1
  let inside = 1
  if (number === 0) {
    return { outside: 0, inside: 1 }
  }
  for (let factor = 2; factor * factor <= number; factor += 1) {
    if (number % (factor * factor) === 0) {
      outside *= factor
      number /= factor * factor
      factor -= 1
    }
  }
  inside = number
  return { outside: outside, inside: inside }
}

function fractionSquareRoot(value) {
  const fraction = Fraction.from(value)
  if (fraction.sign() < 0) {
    throw new Error('负数不能直接开平方')
  }
  const combined = Math.abs(fraction.n * fraction.d)
  if (combined > 100000000) {
    throw new Error('根号内数值过大，请使用较小的整数或分数')
  }
  const simplified = squareFreeInteger(combined)
  return new RadicalSum([
    {
      coefficient: new Fraction(simplified.outside, fraction.d),
      radicand: simplified.inside
    }
  ])
}

class RadicalSum {
  constructor(terms) {
    this.terms = {}
    const list = Array.isArray(terms) ? terms : []
    for (let index = 0; index < list.length; index += 1) {
      const coefficient = Fraction.from(list[index].coefficient)
      const radicand = Math.max(1, Math.trunc(list[index].radicand || 1))
      if (coefficient.isZero()) {
        continue
      }
      const previous = this.terms[radicand] || ZERO
      const sum = previous.add(coefficient)
      if (sum.isZero()) {
        delete this.terms[radicand]
      } else {
        this.terms[radicand] = sum
      }
    }
  }

  add(other) {
    const value = RadicalSum.from(other)
    const keys = Object.keys(this.terms).concat(Object.keys(value.terms)).filter(function (key, index, list) {
      return list.indexOf(key) === index
    })
    const result = new RadicalSum([])
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index]
      result.terms[key] = (result.terms[key] || ZERO)
        .add(this.terms[key] || ZERO)
        .add(value.terms[key] || ZERO)
    }
    return new RadicalSum(this.mapToTerms(result.terms))
  }

  sub(other) {
    return this.add(RadicalSum.from(other).neg())
  }

  neg() {
    return new RadicalSum(this.mapToTerms(this.terms).map(function (term) {
      return {
        coefficient: term.coefficient.neg(),
        radicand: term.radicand
      }
    }))
  }

  mul(other) {
    const value = RadicalSum.from(other)
    const terms = []
    const leftKeys = Object.keys(this.terms)
    const rightKeys = Object.keys(value.terms)
    for (let i = 0; i < leftKeys.length; i += 1) {
      for (let j = 0; j < rightKeys.length; j += 1) {
        const left = {
          coefficient: this.terms[leftKeys[i]],
          radicand: Number(leftKeys[i])
        }
        const right = {
          coefficient: value.terms[rightKeys[j]],
          radicand: Number(rightKeys[j])
        }
        const product = squareFreeInteger(left.radicand * right.radicand)
        terms.push({
          coefficient: left.coefficient.mul(right.coefficient).mul(new Fraction(product.outside, 1)),
          radicand: product.inside
        })
      }
    }
    return new RadicalSum(terms)
  }

  div(other) {
    const value = RadicalSum.from(other)
    if (value.isZero()) {
      throw new Error('除数不能为 0')
    }
    const keys = Object.keys(value.terms)
    if (keys.length === 1) {
      const radicand = Number(keys[0])
      const coefficient = value.terms[keys[0]]
      const denominatorSquared = new Fraction(radicand, 1).mul(coefficient).mul(coefficient)
      const inverseDenominator = RadicalSum.fromFraction(denominatorSquared.inv())
      return this.mul(RadicalSum.from({
        terms: {
          [radicand]: coefficient
        }
      })).mul(inverseDenominator)
    }
    const rationalKey = keys.indexOf('1') >= 0 ? '1' : ''
    const radicalKeys = keys.filter(function (key) {
      return key !== '1'
    })
    if (rationalKey && radicalKeys.length === 1) {
      const a = value.terms['1']
      const b = value.terms[radicalKeys[0]]
      const r = Number(radicalKeys[0])
      const conjugate = new RadicalSum([
        { coefficient: a, radicand: 1 },
        { coefficient: b.neg(), radicand: r }
      ])
      const denominator = a.mul(a).sub(b.mul(b).mul(new Fraction(r, 1)))
      if (denominator.isZero()) {
        throw new Error('分母有理化后为 0')
      }
      return this.mul(conjugate).mul(RadicalSum.fromFraction(denominator.inv()))
    }
    throw new Error('暂不支持含有多个不同根式的复杂分母')
  }

  isZero() {
    return Object.keys(this.terms).length === 0
  }

  isRational() {
    const keys = Object.keys(this.terms).filter(function (key) {
      return key !== '1'
    })
    return keys.length === 0
  }

  toNumber() {
    let result = 0
    const keys = Object.keys(this.terms)
    for (let index = 0; index < keys.length; index += 1) {
      result += this.terms[keys[index]].toNumber() * Math.sqrt(Number(keys[index]))
    }
    return result
  }

  toFraction() {
    if (!this.isRational()) {
      throw new Error('该值不是有理数')
    }
    return this.terms['1'] || ZERO
  }

  toString() {
    const keys = Object.keys(this.terms).sort(function (a, b) {
      return Number(a) - Number(b)
    })
    if (!keys.length) {
      return '0'
    }
    let output = ''
    for (let index = 0; index < keys.length; index += 1) {
      const radicand = Number(keys[index])
      const coefficient = this.terms[keys[index]]
      const negative = coefficient.sign() < 0
      const absolute = coefficient.abs()
      let body = ''
      if (radicand === 1) {
        body = absolute.toString()
      } else {
        if (!absolute.isOne()) {
          body += absolute.toString()
        }
        body += '√' + radicand
      }
      if (index === 0) {
        output += negative ? '-' : ''
      } else {
        output += negative ? ' - ' : ' + '
      }
      output += body
    }
    return output
  }

  mapToTerms(source) {
    const keys = Object.keys(source)
    return keys.map(function (key) {
      return {
        coefficient: source[key],
        radicand: Number(key)
      }
    })
  }

  static from(value) {
    if (value instanceof RadicalSum) {
      return value
    }
    if (value && value.terms) {
      const keys = Object.keys(value.terms)
      return new RadicalSum(keys.map(function (key) {
        return {
          coefficient: value.terms[key],
          radicand: Number(key)
        }
      }))
    }
    return RadicalSum.fromFraction(value)
  }

  static fromFraction(value) {
    return new RadicalSum([
      { coefficient: Fraction.from(value), radicand: 1 }
    ])
  }
}

function isPerfectSquareFraction(value) {
  const fraction = Fraction.from(value)
  return fraction.sign() >= 0 &&
    isPerfectSquareInteger(fraction.n) &&
    isPerfectSquareInteger(fraction.d)
}

function rationalSquareRoot(value) {
  const fraction = Fraction.from(value)
  if (!isPerfectSquareFraction(fraction)) {
    return null
  }
  return new Fraction(Math.round(Math.sqrt(fraction.n)), Math.round(Math.sqrt(fraction.d)))
}

module.exports = {
  RadicalSum: RadicalSum,
  fractionSquareRoot: fractionSquareRoot,
  squareFreeInteger: squareFreeInteger,
  isPerfectSquareFraction: isPerfectSquareFraction,
  rationalSquareRoot: rationalSquareRoot
}
