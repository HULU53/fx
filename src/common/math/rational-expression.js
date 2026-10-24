'use strict'

const Polynomial = require('./polynomial').Polynomial
const polynomialGcd = require('./polynomial').polynomialGcd

class RationalExpression {
  constructor(numerator, denominator) {
    let top = Polynomial.from(numerator || Polynomial.ZERO)
    let bottom = Polynomial.from(denominator || Polynomial.ONE)
    if (bottom.isZero()) {
      throw new Error('分母不能为 0')
    }
    if (top.isZero()) {
      this.numerator = Polynomial.ZERO
      this.denominator = Polynomial.ONE
      return
    }
    const divisor = polynomialGcd(top, bottom)
    if (divisor.degree() > 0) {
      top = top.div(divisor)
      bottom = bottom.div(divisor)
    }
    const lead = bottom.coefficient(bottom.degree())
    if (!lead.isOne()) {
      top = top.scale(lead.inv())
      bottom = bottom.scale(lead.inv())
    }
    this.numerator = top
    this.denominator = bottom
  }

  add(other) {
    const value = RationalExpression.from(other)
    return new RationalExpression(
      this.numerator.mul(value.denominator).add(value.numerator.mul(this.denominator)),
      this.denominator.mul(value.denominator)
    )
  }

  sub(other) {
    return this.add(RationalExpression.from(other).neg())
  }

  neg() {
    return new RationalExpression(this.numerator.neg(), this.denominator)
  }

  mul(other) {
    const value = RationalExpression.from(other)
    return new RationalExpression(
      this.numerator.mul(value.numerator),
      this.denominator.mul(value.denominator)
    )
  }

  div(other) {
    const value = RationalExpression.from(other)
    if (value.numerator.isZero()) {
      throw new Error('除数不能为 0')
    }
    return new RationalExpression(
      this.numerator.mul(value.denominator),
      this.denominator.mul(value.numerator)
    )
  }

  isPolynomial() {
    return this.denominator.degree() === 0
  }

  toString() {
    if (this.denominator.degree() === 0) {
      const scale = this.denominator.coefficient(0)
      return scale.isOne() ? this.numerator.toString() : '(' + this.numerator.toString() + ')/' + scale.toString()
    }
    const top = this.numerator.degree() > 1 ? '(' + this.numerator.toString() + ')' : this.numerator.toString()
    const bottom = this.denominator.degree() > 1 ? '(' + this.denominator.toString() + ')' : this.denominator.toString()
    return top + '/' + bottom
  }

  static from(value) {
    if (value instanceof RationalExpression) {
      return value
    }
    if (value instanceof Polynomial) {
      return new RationalExpression(value, Polynomial.ONE)
    }
    return new RationalExpression(Polynomial.constant(value), Polynomial.ONE)
  }
}

module.exports = {
  RationalExpression: RationalExpression
}
