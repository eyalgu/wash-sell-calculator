"use strict";
(() => {
  // ../../node_modules/.pnpm/decimal.js@10.6.0/node_modules/decimal.js/decimal.mjs
  var EXP_LIMIT = 9e15;
  var MAX_DIGITS = 1e9;
  var NUMERALS = "0123456789abcdef";
  var LN10 = "2.3025850929940456840179914546843642076011014886287729760333279009675726096773524802359972050895982983419677840422862486334095254650828067566662873690987816894829072083255546808437998948262331985283935053089653777326288461633662222876982198867465436674744042432743651550489343149393914796194044002221051017141748003688084012647080685567743216228355220114804663715659121373450747856947683463616792101806445070648000277502684916746550586856935673420670581136429224554405758925724208241314695689016758940256776311356919292033376587141660230105703089634572075440370847469940168269282808481184289314848524948644871927809676271275775397027668605952496716674183485704422507197965004714951050492214776567636938662976979522110718264549734772662425709429322582798502585509785265383207606726317164309505995087807523710333101197857547331541421808427543863591778117054309827482385045648019095610299291824318237525357709750539565187697510374970888692180205189339507238539205144634197265287286965110862571492198849978748873771345686209167058";
  var PI = "3.1415926535897932384626433832795028841971693993751058209749445923078164062862089986280348253421170679821480865132823066470938446095505822317253594081284811174502841027019385211055596446229489549303819644288109756659334461284756482337867831652712019091456485669234603486104543266482133936072602491412737245870066063155881748815209209628292540917153643678925903600113305305488204665213841469519415116094330572703657595919530921861173819326117931051185480744623799627495673518857527248912279381830119491298336733624406566430860213949463952247371907021798609437027705392171762931767523846748184676694051320005681271452635608277857713427577896091736371787214684409012249534301465495853710507922796892589235420199561121290219608640344181598136297747713099605187072113499999983729780499510597317328160963185950244594553469083026425223082533446850352619311881710100031378387528865875332083814206171776691473035982534904287554687311595628638823537875937519577818577805321712268066130019278766111959092164201989380952572010654858632789";
  var DEFAULTS = {
    // These values must be integers within the stated ranges (inclusive).
    // Most of these values can be changed at run-time using the `Decimal.config` method.
    // The maximum number of significant digits of the result of a calculation or base conversion.
    // E.g. `Decimal.config({ precision: 20 });`
    precision: 20,
    // 1 to MAX_DIGITS
    // The rounding mode used when rounding to `precision`.
    //
    // ROUND_UP         0 Away from zero.
    // ROUND_DOWN       1 Towards zero.
    // ROUND_CEIL       2 Towards +Infinity.
    // ROUND_FLOOR      3 Towards -Infinity.
    // ROUND_HALF_UP    4 Towards nearest neighbour. If equidistant, up.
    // ROUND_HALF_DOWN  5 Towards nearest neighbour. If equidistant, down.
    // ROUND_HALF_EVEN  6 Towards nearest neighbour. If equidistant, towards even neighbour.
    // ROUND_HALF_CEIL  7 Towards nearest neighbour. If equidistant, towards +Infinity.
    // ROUND_HALF_FLOOR 8 Towards nearest neighbour. If equidistant, towards -Infinity.
    //
    // E.g.
    // `Decimal.rounding = 4;`
    // `Decimal.rounding = Decimal.ROUND_HALF_UP;`
    rounding: 4,
    // 0 to 8
    // The modulo mode used when calculating the modulus: a mod n.
    // The quotient (q = a / n) is calculated according to the corresponding rounding mode.
    // The remainder (r) is calculated as: r = a - n * q.
    //
    // UP         0 The remainder is positive if the dividend is negative, else is negative.
    // DOWN       1 The remainder has the same sign as the dividend (JavaScript %).
    // FLOOR      3 The remainder has the same sign as the divisor (Python %).
    // HALF_EVEN  6 The IEEE 754 remainder function.
    // EUCLID     9 Euclidian division. q = sign(n) * floor(a / abs(n)). Always positive.
    //
    // Truncated division (1), floored division (3), the IEEE 754 remainder (6), and Euclidian
    // division (9) are commonly used for the modulus operation. The other rounding modes can also
    // be used, but they may not give useful results.
    modulo: 1,
    // 0 to 9
    // The exponent value at and beneath which `toString` returns exponential notation.
    // JavaScript numbers: -7
    toExpNeg: -7,
    // 0 to -EXP_LIMIT
    // The exponent value at and above which `toString` returns exponential notation.
    // JavaScript numbers: 21
    toExpPos: 21,
    // 0 to EXP_LIMIT
    // The minimum exponent value, beneath which underflow to zero occurs.
    // JavaScript numbers: -324  (5e-324)
    minE: -EXP_LIMIT,
    // -1 to -EXP_LIMIT
    // The maximum exponent value, above which overflow to Infinity occurs.
    // JavaScript numbers: 308  (1.7976931348623157e+308)
    maxE: EXP_LIMIT,
    // 1 to EXP_LIMIT
    // Whether to use cryptographically-secure random number generation, if available.
    crypto: false
    // true/false
  };
  var inexact;
  var quadrant;
  var external = true;
  var decimalError = "[DecimalError] ";
  var invalidArgument = decimalError + "Invalid argument: ";
  var precisionLimitExceeded = decimalError + "Precision limit exceeded";
  var cryptoUnavailable = decimalError + "crypto unavailable";
  var tag = "[object Decimal]";
  var mathfloor = Math.floor;
  var mathpow = Math.pow;
  var isBinary = /^0b([01]+(\.[01]*)?|\.[01]+)(p[+-]?\d+)?$/i;
  var isHex = /^0x([0-9a-f]+(\.[0-9a-f]*)?|\.[0-9a-f]+)(p[+-]?\d+)?$/i;
  var isOctal = /^0o([0-7]+(\.[0-7]*)?|\.[0-7]+)(p[+-]?\d+)?$/i;
  var isDecimal = /^(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i;
  var BASE = 1e7;
  var LOG_BASE = 7;
  var MAX_SAFE_INTEGER = 9007199254740991;
  var LN10_PRECISION = LN10.length - 1;
  var PI_PRECISION = PI.length - 1;
  var P = { toStringTag: tag };
  P.absoluteValue = P.abs = function() {
    var x = new this.constructor(this);
    if (x.s < 0) x.s = 1;
    return finalise(x);
  };
  P.ceil = function() {
    return finalise(new this.constructor(this), this.e + 1, 2);
  };
  P.clampedTo = P.clamp = function(min2, max2) {
    var k, x = this, Ctor = x.constructor;
    min2 = new Ctor(min2);
    max2 = new Ctor(max2);
    if (!min2.s || !max2.s) return new Ctor(NaN);
    if (min2.gt(max2)) throw Error(invalidArgument + max2);
    k = x.cmp(min2);
    return k < 0 ? min2 : x.cmp(max2) > 0 ? max2 : new Ctor(x);
  };
  P.comparedTo = P.cmp = function(y) {
    var i, j, xdL, ydL, x = this, xd = x.d, yd = (y = new x.constructor(y)).d, xs = x.s, ys = y.s;
    if (!xd || !yd) {
      return !xs || !ys ? NaN : xs !== ys ? xs : xd === yd ? 0 : !xd ^ xs < 0 ? 1 : -1;
    }
    if (!xd[0] || !yd[0]) return xd[0] ? xs : yd[0] ? -ys : 0;
    if (xs !== ys) return xs;
    if (x.e !== y.e) return x.e > y.e ^ xs < 0 ? 1 : -1;
    xdL = xd.length;
    ydL = yd.length;
    for (i = 0, j = xdL < ydL ? xdL : ydL; i < j; ++i) {
      if (xd[i] !== yd[i]) return xd[i] > yd[i] ^ xs < 0 ? 1 : -1;
    }
    return xdL === ydL ? 0 : xdL > ydL ^ xs < 0 ? 1 : -1;
  };
  P.cosine = P.cos = function() {
    var pr, rm, x = this, Ctor = x.constructor;
    if (!x.d) return new Ctor(NaN);
    if (!x.d[0]) return new Ctor(1);
    pr = Ctor.precision;
    rm = Ctor.rounding;
    Ctor.precision = pr + Math.max(x.e, x.sd()) + LOG_BASE;
    Ctor.rounding = 1;
    x = cosine(Ctor, toLessThanHalfPi(Ctor, x));
    Ctor.precision = pr;
    Ctor.rounding = rm;
    return finalise(quadrant == 2 || quadrant == 3 ? x.neg() : x, pr, rm, true);
  };
  P.cubeRoot = P.cbrt = function() {
    var e, m, n, r, rep, s, sd, t, t3, t3plusx, x = this, Ctor = x.constructor;
    if (!x.isFinite() || x.isZero()) return new Ctor(x);
    external = false;
    s = x.s * mathpow(x.s * x, 1 / 3);
    if (!s || Math.abs(s) == 1 / 0) {
      n = digitsToString(x.d);
      e = x.e;
      if (s = (e - n.length + 1) % 3) n += s == 1 || s == -2 ? "0" : "00";
      s = mathpow(n, 1 / 3);
      e = mathfloor((e + 1) / 3) - (e % 3 == (e < 0 ? -1 : 2));
      if (s == 1 / 0) {
        n = "5e" + e;
      } else {
        n = s.toExponential();
        n = n.slice(0, n.indexOf("e") + 1) + e;
      }
      r = new Ctor(n);
      r.s = x.s;
    } else {
      r = new Ctor(s.toString());
    }
    sd = (e = Ctor.precision) + 3;
    for (; ; ) {
      t = r;
      t3 = t.times(t).times(t);
      t3plusx = t3.plus(x);
      r = divide(t3plusx.plus(x).times(t), t3plusx.plus(t3), sd + 2, 1);
      if (digitsToString(t.d).slice(0, sd) === (n = digitsToString(r.d)).slice(0, sd)) {
        n = n.slice(sd - 3, sd + 1);
        if (n == "9999" || !rep && n == "4999") {
          if (!rep) {
            finalise(t, e + 1, 0);
            if (t.times(t).times(t).eq(x)) {
              r = t;
              break;
            }
          }
          sd += 4;
          rep = 1;
        } else {
          if (!+n || !+n.slice(1) && n.charAt(0) == "5") {
            finalise(r, e + 1, 1);
            m = !r.times(r).times(r).eq(x);
          }
          break;
        }
      }
    }
    external = true;
    return finalise(r, e, Ctor.rounding, m);
  };
  P.decimalPlaces = P.dp = function() {
    var w, d2 = this.d, n = NaN;
    if (d2) {
      w = d2.length - 1;
      n = (w - mathfloor(this.e / LOG_BASE)) * LOG_BASE;
      w = d2[w];
      if (w) for (; w % 10 == 0; w /= 10) n--;
      if (n < 0) n = 0;
    }
    return n;
  };
  P.dividedBy = P.div = function(y) {
    return divide(this, new this.constructor(y));
  };
  P.dividedToIntegerBy = P.divToInt = function(y) {
    var x = this, Ctor = x.constructor;
    return finalise(divide(x, new Ctor(y), 0, 1, 1), Ctor.precision, Ctor.rounding);
  };
  P.equals = P.eq = function(y) {
    return this.cmp(y) === 0;
  };
  P.floor = function() {
    return finalise(new this.constructor(this), this.e + 1, 3);
  };
  P.greaterThan = P.gt = function(y) {
    return this.cmp(y) > 0;
  };
  P.greaterThanOrEqualTo = P.gte = function(y) {
    var k = this.cmp(y);
    return k == 1 || k === 0;
  };
  P.hyperbolicCosine = P.cosh = function() {
    var k, n, pr, rm, len, x = this, Ctor = x.constructor, one = new Ctor(1);
    if (!x.isFinite()) return new Ctor(x.s ? 1 / 0 : NaN);
    if (x.isZero()) return one;
    pr = Ctor.precision;
    rm = Ctor.rounding;
    Ctor.precision = pr + Math.max(x.e, x.sd()) + 4;
    Ctor.rounding = 1;
    len = x.d.length;
    if (len < 32) {
      k = Math.ceil(len / 3);
      n = (1 / tinyPow(4, k)).toString();
    } else {
      k = 16;
      n = "2.3283064365386962890625e-10";
    }
    x = taylorSeries(Ctor, 1, x.times(n), new Ctor(1), true);
    var cosh2_x, i = k, d8 = new Ctor(8);
    for (; i--; ) {
      cosh2_x = x.times(x);
      x = one.minus(cosh2_x.times(d8.minus(cosh2_x.times(d8))));
    }
    return finalise(x, Ctor.precision = pr, Ctor.rounding = rm, true);
  };
  P.hyperbolicSine = P.sinh = function() {
    var k, pr, rm, len, x = this, Ctor = x.constructor;
    if (!x.isFinite() || x.isZero()) return new Ctor(x);
    pr = Ctor.precision;
    rm = Ctor.rounding;
    Ctor.precision = pr + Math.max(x.e, x.sd()) + 4;
    Ctor.rounding = 1;
    len = x.d.length;
    if (len < 3) {
      x = taylorSeries(Ctor, 2, x, x, true);
    } else {
      k = 1.4 * Math.sqrt(len);
      k = k > 16 ? 16 : k | 0;
      x = x.times(1 / tinyPow(5, k));
      x = taylorSeries(Ctor, 2, x, x, true);
      var sinh2_x, d5 = new Ctor(5), d16 = new Ctor(16), d20 = new Ctor(20);
      for (; k--; ) {
        sinh2_x = x.times(x);
        x = x.times(d5.plus(sinh2_x.times(d16.times(sinh2_x).plus(d20))));
      }
    }
    Ctor.precision = pr;
    Ctor.rounding = rm;
    return finalise(x, pr, rm, true);
  };
  P.hyperbolicTangent = P.tanh = function() {
    var pr, rm, x = this, Ctor = x.constructor;
    if (!x.isFinite()) return new Ctor(x.s);
    if (x.isZero()) return new Ctor(x);
    pr = Ctor.precision;
    rm = Ctor.rounding;
    Ctor.precision = pr + 7;
    Ctor.rounding = 1;
    return divide(x.sinh(), x.cosh(), Ctor.precision = pr, Ctor.rounding = rm);
  };
  P.inverseCosine = P.acos = function() {
    var x = this, Ctor = x.constructor, k = x.abs().cmp(1), pr = Ctor.precision, rm = Ctor.rounding;
    if (k !== -1) {
      return k === 0 ? x.isNeg() ? getPi(Ctor, pr, rm) : new Ctor(0) : new Ctor(NaN);
    }
    if (x.isZero()) return getPi(Ctor, pr + 4, rm).times(0.5);
    Ctor.precision = pr + 6;
    Ctor.rounding = 1;
    x = new Ctor(1).minus(x).div(x.plus(1)).sqrt().atan();
    Ctor.precision = pr;
    Ctor.rounding = rm;
    return x.times(2);
  };
  P.inverseHyperbolicCosine = P.acosh = function() {
    var pr, rm, x = this, Ctor = x.constructor;
    if (x.lte(1)) return new Ctor(x.eq(1) ? 0 : NaN);
    if (!x.isFinite()) return new Ctor(x);
    pr = Ctor.precision;
    rm = Ctor.rounding;
    Ctor.precision = pr + Math.max(Math.abs(x.e), x.sd()) + 4;
    Ctor.rounding = 1;
    external = false;
    x = x.times(x).minus(1).sqrt().plus(x);
    external = true;
    Ctor.precision = pr;
    Ctor.rounding = rm;
    return x.ln();
  };
  P.inverseHyperbolicSine = P.asinh = function() {
    var pr, rm, x = this, Ctor = x.constructor;
    if (!x.isFinite() || x.isZero()) return new Ctor(x);
    pr = Ctor.precision;
    rm = Ctor.rounding;
    Ctor.precision = pr + 2 * Math.max(Math.abs(x.e), x.sd()) + 6;
    Ctor.rounding = 1;
    external = false;
    x = x.times(x).plus(1).sqrt().plus(x);
    external = true;
    Ctor.precision = pr;
    Ctor.rounding = rm;
    return x.ln();
  };
  P.inverseHyperbolicTangent = P.atanh = function() {
    var pr, rm, wpr, xsd, x = this, Ctor = x.constructor;
    if (!x.isFinite()) return new Ctor(NaN);
    if (x.e >= 0) return new Ctor(x.abs().eq(1) ? x.s / 0 : x.isZero() ? x : NaN);
    pr = Ctor.precision;
    rm = Ctor.rounding;
    xsd = x.sd();
    if (Math.max(xsd, pr) < 2 * -x.e - 1) return finalise(new Ctor(x), pr, rm, true);
    Ctor.precision = wpr = xsd - x.e;
    x = divide(x.plus(1), new Ctor(1).minus(x), wpr + pr, 1);
    Ctor.precision = pr + 4;
    Ctor.rounding = 1;
    x = x.ln();
    Ctor.precision = pr;
    Ctor.rounding = rm;
    return x.times(0.5);
  };
  P.inverseSine = P.asin = function() {
    var halfPi, k, pr, rm, x = this, Ctor = x.constructor;
    if (x.isZero()) return new Ctor(x);
    k = x.abs().cmp(1);
    pr = Ctor.precision;
    rm = Ctor.rounding;
    if (k !== -1) {
      if (k === 0) {
        halfPi = getPi(Ctor, pr + 4, rm).times(0.5);
        halfPi.s = x.s;
        return halfPi;
      }
      return new Ctor(NaN);
    }
    Ctor.precision = pr + 6;
    Ctor.rounding = 1;
    x = x.div(new Ctor(1).minus(x.times(x)).sqrt().plus(1)).atan();
    Ctor.precision = pr;
    Ctor.rounding = rm;
    return x.times(2);
  };
  P.inverseTangent = P.atan = function() {
    var i, j, k, n, px, t, r, wpr, x2, x = this, Ctor = x.constructor, pr = Ctor.precision, rm = Ctor.rounding;
    if (!x.isFinite()) {
      if (!x.s) return new Ctor(NaN);
      if (pr + 4 <= PI_PRECISION) {
        r = getPi(Ctor, pr + 4, rm).times(0.5);
        r.s = x.s;
        return r;
      }
    } else if (x.isZero()) {
      return new Ctor(x);
    } else if (x.abs().eq(1) && pr + 4 <= PI_PRECISION) {
      r = getPi(Ctor, pr + 4, rm).times(0.25);
      r.s = x.s;
      return r;
    }
    Ctor.precision = wpr = pr + 10;
    Ctor.rounding = 1;
    k = Math.min(28, wpr / LOG_BASE + 2 | 0);
    for (i = k; i; --i) x = x.div(x.times(x).plus(1).sqrt().plus(1));
    external = false;
    j = Math.ceil(wpr / LOG_BASE);
    n = 1;
    x2 = x.times(x);
    r = new Ctor(x);
    px = x;
    for (; i !== -1; ) {
      px = px.times(x2);
      t = r.minus(px.div(n += 2));
      px = px.times(x2);
      r = t.plus(px.div(n += 2));
      if (r.d[j] !== void 0) for (i = j; r.d[i] === t.d[i] && i--; ) ;
    }
    if (k) r = r.times(2 << k - 1);
    external = true;
    return finalise(r, Ctor.precision = pr, Ctor.rounding = rm, true);
  };
  P.isFinite = function() {
    return !!this.d;
  };
  P.isInteger = P.isInt = function() {
    return !!this.d && mathfloor(this.e / LOG_BASE) > this.d.length - 2;
  };
  P.isNaN = function() {
    return !this.s;
  };
  P.isNegative = P.isNeg = function() {
    return this.s < 0;
  };
  P.isPositive = P.isPos = function() {
    return this.s > 0;
  };
  P.isZero = function() {
    return !!this.d && this.d[0] === 0;
  };
  P.lessThan = P.lt = function(y) {
    return this.cmp(y) < 0;
  };
  P.lessThanOrEqualTo = P.lte = function(y) {
    return this.cmp(y) < 1;
  };
  P.logarithm = P.log = function(base) {
    var isBase10, d2, denominator, k, inf, num, sd, r, arg = this, Ctor = arg.constructor, pr = Ctor.precision, rm = Ctor.rounding, guard = 5;
    if (base == null) {
      base = new Ctor(10);
      isBase10 = true;
    } else {
      base = new Ctor(base);
      d2 = base.d;
      if (base.s < 0 || !d2 || !d2[0] || base.eq(1)) return new Ctor(NaN);
      isBase10 = base.eq(10);
    }
    d2 = arg.d;
    if (arg.s < 0 || !d2 || !d2[0] || arg.eq(1)) {
      return new Ctor(d2 && !d2[0] ? -1 / 0 : arg.s != 1 ? NaN : d2 ? 0 : 1 / 0);
    }
    if (isBase10) {
      if (d2.length > 1) {
        inf = true;
      } else {
        for (k = d2[0]; k % 10 === 0; ) k /= 10;
        inf = k !== 1;
      }
    }
    external = false;
    sd = pr + guard;
    num = naturalLogarithm(arg, sd);
    denominator = isBase10 ? getLn10(Ctor, sd + 10) : naturalLogarithm(base, sd);
    r = divide(num, denominator, sd, 1);
    if (checkRoundingDigits(r.d, k = pr, rm)) {
      do {
        sd += 10;
        num = naturalLogarithm(arg, sd);
        denominator = isBase10 ? getLn10(Ctor, sd + 10) : naturalLogarithm(base, sd);
        r = divide(num, denominator, sd, 1);
        if (!inf) {
          if (+digitsToString(r.d).slice(k + 1, k + 15) + 1 == 1e14) {
            r = finalise(r, pr + 1, 0);
          }
          break;
        }
      } while (checkRoundingDigits(r.d, k += 10, rm));
    }
    external = true;
    return finalise(r, pr, rm);
  };
  P.minus = P.sub = function(y) {
    var d2, e, i, j, k, len, pr, rm, xd, xe, xLTy, yd, x = this, Ctor = x.constructor;
    y = new Ctor(y);
    if (!x.d || !y.d) {
      if (!x.s || !y.s) y = new Ctor(NaN);
      else if (x.d) y.s = -y.s;
      else y = new Ctor(y.d || x.s !== y.s ? x : NaN);
      return y;
    }
    if (x.s != y.s) {
      y.s = -y.s;
      return x.plus(y);
    }
    xd = x.d;
    yd = y.d;
    pr = Ctor.precision;
    rm = Ctor.rounding;
    if (!xd[0] || !yd[0]) {
      if (yd[0]) y.s = -y.s;
      else if (xd[0]) y = new Ctor(x);
      else return new Ctor(rm === 3 ? -0 : 0);
      return external ? finalise(y, pr, rm) : y;
    }
    e = mathfloor(y.e / LOG_BASE);
    xe = mathfloor(x.e / LOG_BASE);
    xd = xd.slice();
    k = xe - e;
    if (k) {
      xLTy = k < 0;
      if (xLTy) {
        d2 = xd;
        k = -k;
        len = yd.length;
      } else {
        d2 = yd;
        e = xe;
        len = xd.length;
      }
      i = Math.max(Math.ceil(pr / LOG_BASE), len) + 2;
      if (k > i) {
        k = i;
        d2.length = 1;
      }
      d2.reverse();
      for (i = k; i--; ) d2.push(0);
      d2.reverse();
    } else {
      i = xd.length;
      len = yd.length;
      xLTy = i < len;
      if (xLTy) len = i;
      for (i = 0; i < len; i++) {
        if (xd[i] != yd[i]) {
          xLTy = xd[i] < yd[i];
          break;
        }
      }
      k = 0;
    }
    if (xLTy) {
      d2 = xd;
      xd = yd;
      yd = d2;
      y.s = -y.s;
    }
    len = xd.length;
    for (i = yd.length - len; i > 0; --i) xd[len++] = 0;
    for (i = yd.length; i > k; ) {
      if (xd[--i] < yd[i]) {
        for (j = i; j && xd[--j] === 0; ) xd[j] = BASE - 1;
        --xd[j];
        xd[i] += BASE;
      }
      xd[i] -= yd[i];
    }
    for (; xd[--len] === 0; ) xd.pop();
    for (; xd[0] === 0; xd.shift()) --e;
    if (!xd[0]) return new Ctor(rm === 3 ? -0 : 0);
    y.d = xd;
    y.e = getBase10Exponent(xd, e);
    return external ? finalise(y, pr, rm) : y;
  };
  P.modulo = P.mod = function(y) {
    var q, x = this, Ctor = x.constructor;
    y = new Ctor(y);
    if (!x.d || !y.s || y.d && !y.d[0]) return new Ctor(NaN);
    if (!y.d || x.d && !x.d[0]) {
      return finalise(new Ctor(x), Ctor.precision, Ctor.rounding);
    }
    external = false;
    if (Ctor.modulo == 9) {
      q = divide(x, y.abs(), 0, 3, 1);
      q.s *= y.s;
    } else {
      q = divide(x, y, 0, Ctor.modulo, 1);
    }
    q = q.times(y);
    external = true;
    return x.minus(q);
  };
  P.naturalExponential = P.exp = function() {
    return naturalExponential(this);
  };
  P.naturalLogarithm = P.ln = function() {
    return naturalLogarithm(this);
  };
  P.negated = P.neg = function() {
    var x = new this.constructor(this);
    x.s = -x.s;
    return finalise(x);
  };
  P.plus = P.add = function(y) {
    var carry, d2, e, i, k, len, pr, rm, xd, yd, x = this, Ctor = x.constructor;
    y = new Ctor(y);
    if (!x.d || !y.d) {
      if (!x.s || !y.s) y = new Ctor(NaN);
      else if (!x.d) y = new Ctor(y.d || x.s === y.s ? x : NaN);
      return y;
    }
    if (x.s != y.s) {
      y.s = -y.s;
      return x.minus(y);
    }
    xd = x.d;
    yd = y.d;
    pr = Ctor.precision;
    rm = Ctor.rounding;
    if (!xd[0] || !yd[0]) {
      if (!yd[0]) y = new Ctor(x);
      return external ? finalise(y, pr, rm) : y;
    }
    k = mathfloor(x.e / LOG_BASE);
    e = mathfloor(y.e / LOG_BASE);
    xd = xd.slice();
    i = k - e;
    if (i) {
      if (i < 0) {
        d2 = xd;
        i = -i;
        len = yd.length;
      } else {
        d2 = yd;
        e = k;
        len = xd.length;
      }
      k = Math.ceil(pr / LOG_BASE);
      len = k > len ? k + 1 : len + 1;
      if (i > len) {
        i = len;
        d2.length = 1;
      }
      d2.reverse();
      for (; i--; ) d2.push(0);
      d2.reverse();
    }
    len = xd.length;
    i = yd.length;
    if (len - i < 0) {
      i = len;
      d2 = yd;
      yd = xd;
      xd = d2;
    }
    for (carry = 0; i; ) {
      carry = (xd[--i] = xd[i] + yd[i] + carry) / BASE | 0;
      xd[i] %= BASE;
    }
    if (carry) {
      xd.unshift(carry);
      ++e;
    }
    for (len = xd.length; xd[--len] == 0; ) xd.pop();
    y.d = xd;
    y.e = getBase10Exponent(xd, e);
    return external ? finalise(y, pr, rm) : y;
  };
  P.precision = P.sd = function(z) {
    var k, x = this;
    if (z !== void 0 && z !== !!z && z !== 1 && z !== 0) throw Error(invalidArgument + z);
    if (x.d) {
      k = getPrecision(x.d);
      if (z && x.e + 1 > k) k = x.e + 1;
    } else {
      k = NaN;
    }
    return k;
  };
  P.round = function() {
    var x = this, Ctor = x.constructor;
    return finalise(new Ctor(x), x.e + 1, Ctor.rounding);
  };
  P.sine = P.sin = function() {
    var pr, rm, x = this, Ctor = x.constructor;
    if (!x.isFinite()) return new Ctor(NaN);
    if (x.isZero()) return new Ctor(x);
    pr = Ctor.precision;
    rm = Ctor.rounding;
    Ctor.precision = pr + Math.max(x.e, x.sd()) + LOG_BASE;
    Ctor.rounding = 1;
    x = sine(Ctor, toLessThanHalfPi(Ctor, x));
    Ctor.precision = pr;
    Ctor.rounding = rm;
    return finalise(quadrant > 2 ? x.neg() : x, pr, rm, true);
  };
  P.squareRoot = P.sqrt = function() {
    var m, n, sd, r, rep, t, x = this, d2 = x.d, e = x.e, s = x.s, Ctor = x.constructor;
    if (s !== 1 || !d2 || !d2[0]) {
      return new Ctor(!s || s < 0 && (!d2 || d2[0]) ? NaN : d2 ? x : 1 / 0);
    }
    external = false;
    s = Math.sqrt(+x);
    if (s == 0 || s == 1 / 0) {
      n = digitsToString(d2);
      if ((n.length + e) % 2 == 0) n += "0";
      s = Math.sqrt(n);
      e = mathfloor((e + 1) / 2) - (e < 0 || e % 2);
      if (s == 1 / 0) {
        n = "5e" + e;
      } else {
        n = s.toExponential();
        n = n.slice(0, n.indexOf("e") + 1) + e;
      }
      r = new Ctor(n);
    } else {
      r = new Ctor(s.toString());
    }
    sd = (e = Ctor.precision) + 3;
    for (; ; ) {
      t = r;
      r = t.plus(divide(x, t, sd + 2, 1)).times(0.5);
      if (digitsToString(t.d).slice(0, sd) === (n = digitsToString(r.d)).slice(0, sd)) {
        n = n.slice(sd - 3, sd + 1);
        if (n == "9999" || !rep && n == "4999") {
          if (!rep) {
            finalise(t, e + 1, 0);
            if (t.times(t).eq(x)) {
              r = t;
              break;
            }
          }
          sd += 4;
          rep = 1;
        } else {
          if (!+n || !+n.slice(1) && n.charAt(0) == "5") {
            finalise(r, e + 1, 1);
            m = !r.times(r).eq(x);
          }
          break;
        }
      }
    }
    external = true;
    return finalise(r, e, Ctor.rounding, m);
  };
  P.tangent = P.tan = function() {
    var pr, rm, x = this, Ctor = x.constructor;
    if (!x.isFinite()) return new Ctor(NaN);
    if (x.isZero()) return new Ctor(x);
    pr = Ctor.precision;
    rm = Ctor.rounding;
    Ctor.precision = pr + 10;
    Ctor.rounding = 1;
    x = x.sin();
    x.s = 1;
    x = divide(x, new Ctor(1).minus(x.times(x)).sqrt(), pr + 10, 0);
    Ctor.precision = pr;
    Ctor.rounding = rm;
    return finalise(quadrant == 2 || quadrant == 4 ? x.neg() : x, pr, rm, true);
  };
  P.times = P.mul = function(y) {
    var carry, e, i, k, r, rL, t, xdL, ydL, x = this, Ctor = x.constructor, xd = x.d, yd = (y = new Ctor(y)).d;
    y.s *= x.s;
    if (!xd || !xd[0] || !yd || !yd[0]) {
      return new Ctor(!y.s || xd && !xd[0] && !yd || yd && !yd[0] && !xd ? NaN : !xd || !yd ? y.s / 0 : y.s * 0);
    }
    e = mathfloor(x.e / LOG_BASE) + mathfloor(y.e / LOG_BASE);
    xdL = xd.length;
    ydL = yd.length;
    if (xdL < ydL) {
      r = xd;
      xd = yd;
      yd = r;
      rL = xdL;
      xdL = ydL;
      ydL = rL;
    }
    r = [];
    rL = xdL + ydL;
    for (i = rL; i--; ) r.push(0);
    for (i = ydL; --i >= 0; ) {
      carry = 0;
      for (k = xdL + i; k > i; ) {
        t = r[k] + yd[i] * xd[k - i - 1] + carry;
        r[k--] = t % BASE | 0;
        carry = t / BASE | 0;
      }
      r[k] = (r[k] + carry) % BASE | 0;
    }
    for (; !r[--rL]; ) r.pop();
    if (carry) ++e;
    else r.shift();
    y.d = r;
    y.e = getBase10Exponent(r, e);
    return external ? finalise(y, Ctor.precision, Ctor.rounding) : y;
  };
  P.toBinary = function(sd, rm) {
    return toStringBinary(this, 2, sd, rm);
  };
  P.toDecimalPlaces = P.toDP = function(dp, rm) {
    var x = this, Ctor = x.constructor;
    x = new Ctor(x);
    if (dp === void 0) return x;
    checkInt32(dp, 0, MAX_DIGITS);
    if (rm === void 0) rm = Ctor.rounding;
    else checkInt32(rm, 0, 8);
    return finalise(x, dp + x.e + 1, rm);
  };
  P.toExponential = function(dp, rm) {
    var str, x = this, Ctor = x.constructor;
    if (dp === void 0) {
      str = finiteToString(x, true);
    } else {
      checkInt32(dp, 0, MAX_DIGITS);
      if (rm === void 0) rm = Ctor.rounding;
      else checkInt32(rm, 0, 8);
      x = finalise(new Ctor(x), dp + 1, rm);
      str = finiteToString(x, true, dp + 1);
    }
    return x.isNeg() && !x.isZero() ? "-" + str : str;
  };
  P.toFixed = function(dp, rm) {
    var str, y, x = this, Ctor = x.constructor;
    if (dp === void 0) {
      str = finiteToString(x);
    } else {
      checkInt32(dp, 0, MAX_DIGITS);
      if (rm === void 0) rm = Ctor.rounding;
      else checkInt32(rm, 0, 8);
      y = finalise(new Ctor(x), dp + x.e + 1, rm);
      str = finiteToString(y, false, dp + y.e + 1);
    }
    return x.isNeg() && !x.isZero() ? "-" + str : str;
  };
  P.toFraction = function(maxD) {
    var d2, d0, d1, d22, e, k, n, n0, n1, pr, q, r, x = this, xd = x.d, Ctor = x.constructor;
    if (!xd) return new Ctor(x);
    n1 = d0 = new Ctor(1);
    d1 = n0 = new Ctor(0);
    d2 = new Ctor(d1);
    e = d2.e = getPrecision(xd) - x.e - 1;
    k = e % LOG_BASE;
    d2.d[0] = mathpow(10, k < 0 ? LOG_BASE + k : k);
    if (maxD == null) {
      maxD = e > 0 ? d2 : n1;
    } else {
      n = new Ctor(maxD);
      if (!n.isInt() || n.lt(n1)) throw Error(invalidArgument + n);
      maxD = n.gt(d2) ? e > 0 ? d2 : n1 : n;
    }
    external = false;
    n = new Ctor(digitsToString(xd));
    pr = Ctor.precision;
    Ctor.precision = e = xd.length * LOG_BASE * 2;
    for (; ; ) {
      q = divide(n, d2, 0, 1, 1);
      d22 = d0.plus(q.times(d1));
      if (d22.cmp(maxD) == 1) break;
      d0 = d1;
      d1 = d22;
      d22 = n1;
      n1 = n0.plus(q.times(d22));
      n0 = d22;
      d22 = d2;
      d2 = n.minus(q.times(d22));
      n = d22;
    }
    d22 = divide(maxD.minus(d0), d1, 0, 1, 1);
    n0 = n0.plus(d22.times(n1));
    d0 = d0.plus(d22.times(d1));
    n0.s = n1.s = x.s;
    r = divide(n1, d1, e, 1).minus(x).abs().cmp(divide(n0, d0, e, 1).minus(x).abs()) < 1 ? [n1, d1] : [n0, d0];
    Ctor.precision = pr;
    external = true;
    return r;
  };
  P.toHexadecimal = P.toHex = function(sd, rm) {
    return toStringBinary(this, 16, sd, rm);
  };
  P.toNearest = function(y, rm) {
    var x = this, Ctor = x.constructor;
    x = new Ctor(x);
    if (y == null) {
      if (!x.d) return x;
      y = new Ctor(1);
      rm = Ctor.rounding;
    } else {
      y = new Ctor(y);
      if (rm === void 0) {
        rm = Ctor.rounding;
      } else {
        checkInt32(rm, 0, 8);
      }
      if (!x.d) return y.s ? x : y;
      if (!y.d) {
        if (y.s) y.s = x.s;
        return y;
      }
    }
    if (y.d[0]) {
      external = false;
      x = divide(x, y, 0, rm, 1).times(y);
      external = true;
      finalise(x);
    } else {
      y.s = x.s;
      x = y;
    }
    return x;
  };
  P.toNumber = function() {
    return +this;
  };
  P.toOctal = function(sd, rm) {
    return toStringBinary(this, 8, sd, rm);
  };
  P.toPower = P.pow = function(y) {
    var e, k, pr, r, rm, s, x = this, Ctor = x.constructor, yn = +(y = new Ctor(y));
    if (!x.d || !y.d || !x.d[0] || !y.d[0]) return new Ctor(mathpow(+x, yn));
    x = new Ctor(x);
    if (x.eq(1)) return x;
    pr = Ctor.precision;
    rm = Ctor.rounding;
    if (y.eq(1)) return finalise(x, pr, rm);
    e = mathfloor(y.e / LOG_BASE);
    if (e >= y.d.length - 1 && (k = yn < 0 ? -yn : yn) <= MAX_SAFE_INTEGER) {
      r = intPow(Ctor, x, k, pr);
      return y.s < 0 ? new Ctor(1).div(r) : finalise(r, pr, rm);
    }
    s = x.s;
    if (s < 0) {
      if (e < y.d.length - 1) return new Ctor(NaN);
      if ((y.d[e] & 1) == 0) s = 1;
      if (x.e == 0 && x.d[0] == 1 && x.d.length == 1) {
        x.s = s;
        return x;
      }
    }
    k = mathpow(+x, yn);
    e = k == 0 || !isFinite(k) ? mathfloor(yn * (Math.log("0." + digitsToString(x.d)) / Math.LN10 + x.e + 1)) : new Ctor(k + "").e;
    if (e > Ctor.maxE + 1 || e < Ctor.minE - 1) return new Ctor(e > 0 ? s / 0 : 0);
    external = false;
    Ctor.rounding = x.s = 1;
    k = Math.min(12, (e + "").length);
    r = naturalExponential(y.times(naturalLogarithm(x, pr + k)), pr);
    if (r.d) {
      r = finalise(r, pr + 5, 1);
      if (checkRoundingDigits(r.d, pr, rm)) {
        e = pr + 10;
        r = finalise(naturalExponential(y.times(naturalLogarithm(x, e + k)), e), e + 5, 1);
        if (+digitsToString(r.d).slice(pr + 1, pr + 15) + 1 == 1e14) {
          r = finalise(r, pr + 1, 0);
        }
      }
    }
    r.s = s;
    external = true;
    Ctor.rounding = rm;
    return finalise(r, pr, rm);
  };
  P.toPrecision = function(sd, rm) {
    var str, x = this, Ctor = x.constructor;
    if (sd === void 0) {
      str = finiteToString(x, x.e <= Ctor.toExpNeg || x.e >= Ctor.toExpPos);
    } else {
      checkInt32(sd, 1, MAX_DIGITS);
      if (rm === void 0) rm = Ctor.rounding;
      else checkInt32(rm, 0, 8);
      x = finalise(new Ctor(x), sd, rm);
      str = finiteToString(x, sd <= x.e || x.e <= Ctor.toExpNeg, sd);
    }
    return x.isNeg() && !x.isZero() ? "-" + str : str;
  };
  P.toSignificantDigits = P.toSD = function(sd, rm) {
    var x = this, Ctor = x.constructor;
    if (sd === void 0) {
      sd = Ctor.precision;
      rm = Ctor.rounding;
    } else {
      checkInt32(sd, 1, MAX_DIGITS);
      if (rm === void 0) rm = Ctor.rounding;
      else checkInt32(rm, 0, 8);
    }
    return finalise(new Ctor(x), sd, rm);
  };
  P.toString = function() {
    var x = this, Ctor = x.constructor, str = finiteToString(x, x.e <= Ctor.toExpNeg || x.e >= Ctor.toExpPos);
    return x.isNeg() && !x.isZero() ? "-" + str : str;
  };
  P.truncated = P.trunc = function() {
    return finalise(new this.constructor(this), this.e + 1, 1);
  };
  P.valueOf = P.toJSON = function() {
    var x = this, Ctor = x.constructor, str = finiteToString(x, x.e <= Ctor.toExpNeg || x.e >= Ctor.toExpPos);
    return x.isNeg() ? "-" + str : str;
  };
  function digitsToString(d2) {
    var i, k, ws, indexOfLastWord = d2.length - 1, str = "", w = d2[0];
    if (indexOfLastWord > 0) {
      str += w;
      for (i = 1; i < indexOfLastWord; i++) {
        ws = d2[i] + "";
        k = LOG_BASE - ws.length;
        if (k) str += getZeroString(k);
        str += ws;
      }
      w = d2[i];
      ws = w + "";
      k = LOG_BASE - ws.length;
      if (k) str += getZeroString(k);
    } else if (w === 0) {
      return "0";
    }
    for (; w % 10 === 0; ) w /= 10;
    return str + w;
  }
  function checkInt32(i, min2, max2) {
    if (i !== ~~i || i < min2 || i > max2) {
      throw Error(invalidArgument + i);
    }
  }
  function checkRoundingDigits(d2, i, rm, repeating) {
    var di, k, r, rd;
    for (k = d2[0]; k >= 10; k /= 10) --i;
    if (--i < 0) {
      i += LOG_BASE;
      di = 0;
    } else {
      di = Math.ceil((i + 1) / LOG_BASE);
      i %= LOG_BASE;
    }
    k = mathpow(10, LOG_BASE - i);
    rd = d2[di] % k | 0;
    if (repeating == null) {
      if (i < 3) {
        if (i == 0) rd = rd / 100 | 0;
        else if (i == 1) rd = rd / 10 | 0;
        r = rm < 4 && rd == 99999 || rm > 3 && rd == 49999 || rd == 5e4 || rd == 0;
      } else {
        r = (rm < 4 && rd + 1 == k || rm > 3 && rd + 1 == k / 2) && (d2[di + 1] / k / 100 | 0) == mathpow(10, i - 2) - 1 || (rd == k / 2 || rd == 0) && (d2[di + 1] / k / 100 | 0) == 0;
      }
    } else {
      if (i < 4) {
        if (i == 0) rd = rd / 1e3 | 0;
        else if (i == 1) rd = rd / 100 | 0;
        else if (i == 2) rd = rd / 10 | 0;
        r = (repeating || rm < 4) && rd == 9999 || !repeating && rm > 3 && rd == 4999;
      } else {
        r = ((repeating || rm < 4) && rd + 1 == k || !repeating && rm > 3 && rd + 1 == k / 2) && (d2[di + 1] / k / 1e3 | 0) == mathpow(10, i - 3) - 1;
      }
    }
    return r;
  }
  function convertBase(str, baseIn, baseOut) {
    var j, arr = [0], arrL, i = 0, strL = str.length;
    for (; i < strL; ) {
      for (arrL = arr.length; arrL--; ) arr[arrL] *= baseIn;
      arr[0] += NUMERALS.indexOf(str.charAt(i++));
      for (j = 0; j < arr.length; j++) {
        if (arr[j] > baseOut - 1) {
          if (arr[j + 1] === void 0) arr[j + 1] = 0;
          arr[j + 1] += arr[j] / baseOut | 0;
          arr[j] %= baseOut;
        }
      }
    }
    return arr.reverse();
  }
  function cosine(Ctor, x) {
    var k, len, y;
    if (x.isZero()) return x;
    len = x.d.length;
    if (len < 32) {
      k = Math.ceil(len / 3);
      y = (1 / tinyPow(4, k)).toString();
    } else {
      k = 16;
      y = "2.3283064365386962890625e-10";
    }
    Ctor.precision += k;
    x = taylorSeries(Ctor, 1, x.times(y), new Ctor(1));
    for (var i = k; i--; ) {
      var cos2x = x.times(x);
      x = cos2x.times(cos2x).minus(cos2x).times(8).plus(1);
    }
    Ctor.precision -= k;
    return x;
  }
  var divide = /* @__PURE__ */ function() {
    function multiplyInteger(x, k, base) {
      var temp, carry = 0, i = x.length;
      for (x = x.slice(); i--; ) {
        temp = x[i] * k + carry;
        x[i] = temp % base | 0;
        carry = temp / base | 0;
      }
      if (carry) x.unshift(carry);
      return x;
    }
    function compare(a, b, aL, bL) {
      var i, r;
      if (aL != bL) {
        r = aL > bL ? 1 : -1;
      } else {
        for (i = r = 0; i < aL; i++) {
          if (a[i] != b[i]) {
            r = a[i] > b[i] ? 1 : -1;
            break;
          }
        }
      }
      return r;
    }
    function subtract(a, b, aL, base) {
      var i = 0;
      for (; aL--; ) {
        a[aL] -= i;
        i = a[aL] < b[aL] ? 1 : 0;
        a[aL] = i * base + a[aL] - b[aL];
      }
      for (; !a[0] && a.length > 1; ) a.shift();
    }
    return function(x, y, pr, rm, dp, base) {
      var cmp, e, i, k, logBase, more, prod, prodL, q, qd, rem, remL, rem0, sd, t, xi, xL, yd0, yL, yz, Ctor = x.constructor, sign2 = x.s == y.s ? 1 : -1, xd = x.d, yd = y.d;
      if (!xd || !xd[0] || !yd || !yd[0]) {
        return new Ctor(
          // Return NaN if either NaN, or both Infinity or 0.
          !x.s || !y.s || (xd ? yd && xd[0] == yd[0] : !yd) ? NaN : (
            // Return ±0 if x is 0 or y is ±Infinity, or return ±Infinity as y is 0.
            xd && xd[0] == 0 || !yd ? sign2 * 0 : sign2 / 0
          )
        );
      }
      if (base) {
        logBase = 1;
        e = x.e - y.e;
      } else {
        base = BASE;
        logBase = LOG_BASE;
        e = mathfloor(x.e / logBase) - mathfloor(y.e / logBase);
      }
      yL = yd.length;
      xL = xd.length;
      q = new Ctor(sign2);
      qd = q.d = [];
      for (i = 0; yd[i] == (xd[i] || 0); i++) ;
      if (yd[i] > (xd[i] || 0)) e--;
      if (pr == null) {
        sd = pr = Ctor.precision;
        rm = Ctor.rounding;
      } else if (dp) {
        sd = pr + (x.e - y.e) + 1;
      } else {
        sd = pr;
      }
      if (sd < 0) {
        qd.push(1);
        more = true;
      } else {
        sd = sd / logBase + 2 | 0;
        i = 0;
        if (yL == 1) {
          k = 0;
          yd = yd[0];
          sd++;
          for (; (i < xL || k) && sd--; i++) {
            t = k * base + (xd[i] || 0);
            qd[i] = t / yd | 0;
            k = t % yd | 0;
          }
          more = k || i < xL;
        } else {
          k = base / (yd[0] + 1) | 0;
          if (k > 1) {
            yd = multiplyInteger(yd, k, base);
            xd = multiplyInteger(xd, k, base);
            yL = yd.length;
            xL = xd.length;
          }
          xi = yL;
          rem = xd.slice(0, yL);
          remL = rem.length;
          for (; remL < yL; ) rem[remL++] = 0;
          yz = yd.slice();
          yz.unshift(0);
          yd0 = yd[0];
          if (yd[1] >= base / 2) ++yd0;
          do {
            k = 0;
            cmp = compare(yd, rem, yL, remL);
            if (cmp < 0) {
              rem0 = rem[0];
              if (yL != remL) rem0 = rem0 * base + (rem[1] || 0);
              k = rem0 / yd0 | 0;
              if (k > 1) {
                if (k >= base) k = base - 1;
                prod = multiplyInteger(yd, k, base);
                prodL = prod.length;
                remL = rem.length;
                cmp = compare(prod, rem, prodL, remL);
                if (cmp == 1) {
                  k--;
                  subtract(prod, yL < prodL ? yz : yd, prodL, base);
                }
              } else {
                if (k == 0) cmp = k = 1;
                prod = yd.slice();
              }
              prodL = prod.length;
              if (prodL < remL) prod.unshift(0);
              subtract(rem, prod, remL, base);
              if (cmp == -1) {
                remL = rem.length;
                cmp = compare(yd, rem, yL, remL);
                if (cmp < 1) {
                  k++;
                  subtract(rem, yL < remL ? yz : yd, remL, base);
                }
              }
              remL = rem.length;
            } else if (cmp === 0) {
              k++;
              rem = [0];
            }
            qd[i++] = k;
            if (cmp && rem[0]) {
              rem[remL++] = xd[xi] || 0;
            } else {
              rem = [xd[xi]];
              remL = 1;
            }
          } while ((xi++ < xL || rem[0] !== void 0) && sd--);
          more = rem[0] !== void 0;
        }
        if (!qd[0]) qd.shift();
      }
      if (logBase == 1) {
        q.e = e;
        inexact = more;
      } else {
        for (i = 1, k = qd[0]; k >= 10; k /= 10) i++;
        q.e = i + e * logBase - 1;
        finalise(q, dp ? pr + q.e + 1 : pr, rm, more);
      }
      return q;
    };
  }();
  function finalise(x, sd, rm, isTruncated) {
    var digits, i, j, k, rd, roundUp, w, xd, xdi, Ctor = x.constructor;
    out: if (sd != null) {
      xd = x.d;
      if (!xd) return x;
      for (digits = 1, k = xd[0]; k >= 10; k /= 10) digits++;
      i = sd - digits;
      if (i < 0) {
        i += LOG_BASE;
        j = sd;
        w = xd[xdi = 0];
        rd = w / mathpow(10, digits - j - 1) % 10 | 0;
      } else {
        xdi = Math.ceil((i + 1) / LOG_BASE);
        k = xd.length;
        if (xdi >= k) {
          if (isTruncated) {
            for (; k++ <= xdi; ) xd.push(0);
            w = rd = 0;
            digits = 1;
            i %= LOG_BASE;
            j = i - LOG_BASE + 1;
          } else {
            break out;
          }
        } else {
          w = k = xd[xdi];
          for (digits = 1; k >= 10; k /= 10) digits++;
          i %= LOG_BASE;
          j = i - LOG_BASE + digits;
          rd = j < 0 ? 0 : w / mathpow(10, digits - j - 1) % 10 | 0;
        }
      }
      isTruncated = isTruncated || sd < 0 || xd[xdi + 1] !== void 0 || (j < 0 ? w : w % mathpow(10, digits - j - 1));
      roundUp = rm < 4 ? (rd || isTruncated) && (rm == 0 || rm == (x.s < 0 ? 3 : 2)) : rd > 5 || rd == 5 && (rm == 4 || isTruncated || rm == 6 && // Check whether the digit to the left of the rounding digit is odd.
      (i > 0 ? j > 0 ? w / mathpow(10, digits - j) : 0 : xd[xdi - 1]) % 10 & 1 || rm == (x.s < 0 ? 8 : 7));
      if (sd < 1 || !xd[0]) {
        xd.length = 0;
        if (roundUp) {
          sd -= x.e + 1;
          xd[0] = mathpow(10, (LOG_BASE - sd % LOG_BASE) % LOG_BASE);
          x.e = -sd || 0;
        } else {
          xd[0] = x.e = 0;
        }
        return x;
      }
      if (i == 0) {
        xd.length = xdi;
        k = 1;
        xdi--;
      } else {
        xd.length = xdi + 1;
        k = mathpow(10, LOG_BASE - i);
        xd[xdi] = j > 0 ? (w / mathpow(10, digits - j) % mathpow(10, j) | 0) * k : 0;
      }
      if (roundUp) {
        for (; ; ) {
          if (xdi == 0) {
            for (i = 1, j = xd[0]; j >= 10; j /= 10) i++;
            j = xd[0] += k;
            for (k = 1; j >= 10; j /= 10) k++;
            if (i != k) {
              x.e++;
              if (xd[0] == BASE) xd[0] = 1;
            }
            break;
          } else {
            xd[xdi] += k;
            if (xd[xdi] != BASE) break;
            xd[xdi--] = 0;
            k = 1;
          }
        }
      }
      for (i = xd.length; xd[--i] === 0; ) xd.pop();
    }
    if (external) {
      if (x.e > Ctor.maxE) {
        x.d = null;
        x.e = NaN;
      } else if (x.e < Ctor.minE) {
        x.e = 0;
        x.d = [0];
      }
    }
    return x;
  }
  function finiteToString(x, isExp, sd) {
    if (!x.isFinite()) return nonFiniteToString(x);
    var k, e = x.e, str = digitsToString(x.d), len = str.length;
    if (isExp) {
      if (sd && (k = sd - len) > 0) {
        str = str.charAt(0) + "." + str.slice(1) + getZeroString(k);
      } else if (len > 1) {
        str = str.charAt(0) + "." + str.slice(1);
      }
      str = str + (x.e < 0 ? "e" : "e+") + x.e;
    } else if (e < 0) {
      str = "0." + getZeroString(-e - 1) + str;
      if (sd && (k = sd - len) > 0) str += getZeroString(k);
    } else if (e >= len) {
      str += getZeroString(e + 1 - len);
      if (sd && (k = sd - e - 1) > 0) str = str + "." + getZeroString(k);
    } else {
      if ((k = e + 1) < len) str = str.slice(0, k) + "." + str.slice(k);
      if (sd && (k = sd - len) > 0) {
        if (e + 1 === len) str += ".";
        str += getZeroString(k);
      }
    }
    return str;
  }
  function getBase10Exponent(digits, e) {
    var w = digits[0];
    for (e *= LOG_BASE; w >= 10; w /= 10) e++;
    return e;
  }
  function getLn10(Ctor, sd, pr) {
    if (sd > LN10_PRECISION) {
      external = true;
      if (pr) Ctor.precision = pr;
      throw Error(precisionLimitExceeded);
    }
    return finalise(new Ctor(LN10), sd, 1, true);
  }
  function getPi(Ctor, sd, rm) {
    if (sd > PI_PRECISION) throw Error(precisionLimitExceeded);
    return finalise(new Ctor(PI), sd, rm, true);
  }
  function getPrecision(digits) {
    var w = digits.length - 1, len = w * LOG_BASE + 1;
    w = digits[w];
    if (w) {
      for (; w % 10 == 0; w /= 10) len--;
      for (w = digits[0]; w >= 10; w /= 10) len++;
    }
    return len;
  }
  function getZeroString(k) {
    var zs = "";
    for (; k--; ) zs += "0";
    return zs;
  }
  function intPow(Ctor, x, n, pr) {
    var isTruncated, r = new Ctor(1), k = Math.ceil(pr / LOG_BASE + 4);
    external = false;
    for (; ; ) {
      if (n % 2) {
        r = r.times(x);
        if (truncate(r.d, k)) isTruncated = true;
      }
      n = mathfloor(n / 2);
      if (n === 0) {
        n = r.d.length - 1;
        if (isTruncated && r.d[n] === 0) ++r.d[n];
        break;
      }
      x = x.times(x);
      truncate(x.d, k);
    }
    external = true;
    return r;
  }
  function isOdd(n) {
    return n.d[n.d.length - 1] & 1;
  }
  function maxOrMin(Ctor, args, n) {
    var k, y, x = new Ctor(args[0]), i = 0;
    for (; ++i < args.length; ) {
      y = new Ctor(args[i]);
      if (!y.s) {
        x = y;
        break;
      }
      k = x.cmp(y);
      if (k === n || k === 0 && x.s === n) {
        x = y;
      }
    }
    return x;
  }
  function naturalExponential(x, sd) {
    var denominator, guard, j, pow2, sum2, t, wpr, rep = 0, i = 0, k = 0, Ctor = x.constructor, rm = Ctor.rounding, pr = Ctor.precision;
    if (!x.d || !x.d[0] || x.e > 17) {
      return new Ctor(x.d ? !x.d[0] ? 1 : x.s < 0 ? 0 : 1 / 0 : x.s ? x.s < 0 ? 0 : x : 0 / 0);
    }
    if (sd == null) {
      external = false;
      wpr = pr;
    } else {
      wpr = sd;
    }
    t = new Ctor(0.03125);
    while (x.e > -2) {
      x = x.times(t);
      k += 5;
    }
    guard = Math.log(mathpow(2, k)) / Math.LN10 * 2 + 5 | 0;
    wpr += guard;
    denominator = pow2 = sum2 = new Ctor(1);
    Ctor.precision = wpr;
    for (; ; ) {
      pow2 = finalise(pow2.times(x), wpr, 1);
      denominator = denominator.times(++i);
      t = sum2.plus(divide(pow2, denominator, wpr, 1));
      if (digitsToString(t.d).slice(0, wpr) === digitsToString(sum2.d).slice(0, wpr)) {
        j = k;
        while (j--) sum2 = finalise(sum2.times(sum2), wpr, 1);
        if (sd == null) {
          if (rep < 3 && checkRoundingDigits(sum2.d, wpr - guard, rm, rep)) {
            Ctor.precision = wpr += 10;
            denominator = pow2 = t = new Ctor(1);
            i = 0;
            rep++;
          } else {
            return finalise(sum2, Ctor.precision = pr, rm, external = true);
          }
        } else {
          Ctor.precision = pr;
          return sum2;
        }
      }
      sum2 = t;
    }
  }
  function naturalLogarithm(y, sd) {
    var c, c0, denominator, e, numerator, rep, sum2, t, wpr, x1, x2, n = 1, guard = 10, x = y, xd = x.d, Ctor = x.constructor, rm = Ctor.rounding, pr = Ctor.precision;
    if (x.s < 0 || !xd || !xd[0] || !x.e && xd[0] == 1 && xd.length == 1) {
      return new Ctor(xd && !xd[0] ? -1 / 0 : x.s != 1 ? NaN : xd ? 0 : x);
    }
    if (sd == null) {
      external = false;
      wpr = pr;
    } else {
      wpr = sd;
    }
    Ctor.precision = wpr += guard;
    c = digitsToString(xd);
    c0 = c.charAt(0);
    if (Math.abs(e = x.e) < 15e14) {
      while (c0 < 7 && c0 != 1 || c0 == 1 && c.charAt(1) > 3) {
        x = x.times(y);
        c = digitsToString(x.d);
        c0 = c.charAt(0);
        n++;
      }
      e = x.e;
      if (c0 > 1) {
        x = new Ctor("0." + c);
        e++;
      } else {
        x = new Ctor(c0 + "." + c.slice(1));
      }
    } else {
      t = getLn10(Ctor, wpr + 2, pr).times(e + "");
      x = naturalLogarithm(new Ctor(c0 + "." + c.slice(1)), wpr - guard).plus(t);
      Ctor.precision = pr;
      return sd == null ? finalise(x, pr, rm, external = true) : x;
    }
    x1 = x;
    sum2 = numerator = x = divide(x.minus(1), x.plus(1), wpr, 1);
    x2 = finalise(x.times(x), wpr, 1);
    denominator = 3;
    for (; ; ) {
      numerator = finalise(numerator.times(x2), wpr, 1);
      t = sum2.plus(divide(numerator, new Ctor(denominator), wpr, 1));
      if (digitsToString(t.d).slice(0, wpr) === digitsToString(sum2.d).slice(0, wpr)) {
        sum2 = sum2.times(2);
        if (e !== 0) sum2 = sum2.plus(getLn10(Ctor, wpr + 2, pr).times(e + ""));
        sum2 = divide(sum2, new Ctor(n), wpr, 1);
        if (sd == null) {
          if (checkRoundingDigits(sum2.d, wpr - guard, rm, rep)) {
            Ctor.precision = wpr += guard;
            t = numerator = x = divide(x1.minus(1), x1.plus(1), wpr, 1);
            x2 = finalise(x.times(x), wpr, 1);
            denominator = rep = 1;
          } else {
            return finalise(sum2, Ctor.precision = pr, rm, external = true);
          }
        } else {
          Ctor.precision = pr;
          return sum2;
        }
      }
      sum2 = t;
      denominator += 2;
    }
  }
  function nonFiniteToString(x) {
    return String(x.s * x.s / 0);
  }
  function parseDecimal(x, str) {
    var e, i, len;
    if ((e = str.indexOf(".")) > -1) str = str.replace(".", "");
    if ((i = str.search(/e/i)) > 0) {
      if (e < 0) e = i;
      e += +str.slice(i + 1);
      str = str.substring(0, i);
    } else if (e < 0) {
      e = str.length;
    }
    for (i = 0; str.charCodeAt(i) === 48; i++) ;
    for (len = str.length; str.charCodeAt(len - 1) === 48; --len) ;
    str = str.slice(i, len);
    if (str) {
      len -= i;
      x.e = e = e - i - 1;
      x.d = [];
      i = (e + 1) % LOG_BASE;
      if (e < 0) i += LOG_BASE;
      if (i < len) {
        if (i) x.d.push(+str.slice(0, i));
        for (len -= LOG_BASE; i < len; ) x.d.push(+str.slice(i, i += LOG_BASE));
        str = str.slice(i);
        i = LOG_BASE - str.length;
      } else {
        i -= len;
      }
      for (; i--; ) str += "0";
      x.d.push(+str);
      if (external) {
        if (x.e > x.constructor.maxE) {
          x.d = null;
          x.e = NaN;
        } else if (x.e < x.constructor.minE) {
          x.e = 0;
          x.d = [0];
        }
      }
    } else {
      x.e = 0;
      x.d = [0];
    }
    return x;
  }
  function parseOther(x, str) {
    var base, Ctor, divisor, i, isFloat, len, p, xd, xe;
    if (str.indexOf("_") > -1) {
      str = str.replace(/(\d)_(?=\d)/g, "$1");
      if (isDecimal.test(str)) return parseDecimal(x, str);
    } else if (str === "Infinity" || str === "NaN") {
      if (!+str) x.s = NaN;
      x.e = NaN;
      x.d = null;
      return x;
    }
    if (isHex.test(str)) {
      base = 16;
      str = str.toLowerCase();
    } else if (isBinary.test(str)) {
      base = 2;
    } else if (isOctal.test(str)) {
      base = 8;
    } else {
      throw Error(invalidArgument + str);
    }
    i = str.search(/p/i);
    if (i > 0) {
      p = +str.slice(i + 1);
      str = str.substring(2, i);
    } else {
      str = str.slice(2);
    }
    i = str.indexOf(".");
    isFloat = i >= 0;
    Ctor = x.constructor;
    if (isFloat) {
      str = str.replace(".", "");
      len = str.length;
      i = len - i;
      divisor = intPow(Ctor, new Ctor(base), i, i * 2);
    }
    xd = convertBase(str, base, BASE);
    xe = xd.length - 1;
    for (i = xe; xd[i] === 0; --i) xd.pop();
    if (i < 0) return new Ctor(x.s * 0);
    x.e = getBase10Exponent(xd, xe);
    x.d = xd;
    external = false;
    if (isFloat) x = divide(x, divisor, len * 4);
    if (p) x = x.times(Math.abs(p) < 54 ? mathpow(2, p) : Decimal.pow(2, p));
    external = true;
    return x;
  }
  function sine(Ctor, x) {
    var k, len = x.d.length;
    if (len < 3) {
      return x.isZero() ? x : taylorSeries(Ctor, 2, x, x);
    }
    k = 1.4 * Math.sqrt(len);
    k = k > 16 ? 16 : k | 0;
    x = x.times(1 / tinyPow(5, k));
    x = taylorSeries(Ctor, 2, x, x);
    var sin2_x, d5 = new Ctor(5), d16 = new Ctor(16), d20 = new Ctor(20);
    for (; k--; ) {
      sin2_x = x.times(x);
      x = x.times(d5.plus(sin2_x.times(d16.times(sin2_x).minus(d20))));
    }
    return x;
  }
  function taylorSeries(Ctor, n, x, y, isHyperbolic) {
    var j, t, u, x2, i = 1, pr = Ctor.precision, k = Math.ceil(pr / LOG_BASE);
    external = false;
    x2 = x.times(x);
    u = new Ctor(y);
    for (; ; ) {
      t = divide(u.times(x2), new Ctor(n++ * n++), pr, 1);
      u = isHyperbolic ? y.plus(t) : y.minus(t);
      y = divide(t.times(x2), new Ctor(n++ * n++), pr, 1);
      t = u.plus(y);
      if (t.d[k] !== void 0) {
        for (j = k; t.d[j] === u.d[j] && j--; ) ;
        if (j == -1) break;
      }
      j = u;
      u = y;
      y = t;
      t = j;
      i++;
    }
    external = true;
    t.d.length = k + 1;
    return t;
  }
  function tinyPow(b, e) {
    var n = b;
    while (--e) n *= b;
    return n;
  }
  function toLessThanHalfPi(Ctor, x) {
    var t, isNeg = x.s < 0, pi = getPi(Ctor, Ctor.precision, 1), halfPi = pi.times(0.5);
    x = x.abs();
    if (x.lte(halfPi)) {
      quadrant = isNeg ? 4 : 1;
      return x;
    }
    t = x.divToInt(pi);
    if (t.isZero()) {
      quadrant = isNeg ? 3 : 2;
    } else {
      x = x.minus(t.times(pi));
      if (x.lte(halfPi)) {
        quadrant = isOdd(t) ? isNeg ? 2 : 3 : isNeg ? 4 : 1;
        return x;
      }
      quadrant = isOdd(t) ? isNeg ? 1 : 4 : isNeg ? 3 : 2;
    }
    return x.minus(pi).abs();
  }
  function toStringBinary(x, baseOut, sd, rm) {
    var base, e, i, k, len, roundUp, str, xd, y, Ctor = x.constructor, isExp = sd !== void 0;
    if (isExp) {
      checkInt32(sd, 1, MAX_DIGITS);
      if (rm === void 0) rm = Ctor.rounding;
      else checkInt32(rm, 0, 8);
    } else {
      sd = Ctor.precision;
      rm = Ctor.rounding;
    }
    if (!x.isFinite()) {
      str = nonFiniteToString(x);
    } else {
      str = finiteToString(x);
      i = str.indexOf(".");
      if (isExp) {
        base = 2;
        if (baseOut == 16) {
          sd = sd * 4 - 3;
        } else if (baseOut == 8) {
          sd = sd * 3 - 2;
        }
      } else {
        base = baseOut;
      }
      if (i >= 0) {
        str = str.replace(".", "");
        y = new Ctor(1);
        y.e = str.length - i;
        y.d = convertBase(finiteToString(y), 10, base);
        y.e = y.d.length;
      }
      xd = convertBase(str, 10, base);
      e = len = xd.length;
      for (; xd[--len] == 0; ) xd.pop();
      if (!xd[0]) {
        str = isExp ? "0p+0" : "0";
      } else {
        if (i < 0) {
          e--;
        } else {
          x = new Ctor(x);
          x.d = xd;
          x.e = e;
          x = divide(x, y, sd, rm, 0, base);
          xd = x.d;
          e = x.e;
          roundUp = inexact;
        }
        i = xd[sd];
        k = base / 2;
        roundUp = roundUp || xd[sd + 1] !== void 0;
        roundUp = rm < 4 ? (i !== void 0 || roundUp) && (rm === 0 || rm === (x.s < 0 ? 3 : 2)) : i > k || i === k && (rm === 4 || roundUp || rm === 6 && xd[sd - 1] & 1 || rm === (x.s < 0 ? 8 : 7));
        xd.length = sd;
        if (roundUp) {
          for (; ++xd[--sd] > base - 1; ) {
            xd[sd] = 0;
            if (!sd) {
              ++e;
              xd.unshift(1);
            }
          }
        }
        for (len = xd.length; !xd[len - 1]; --len) ;
        for (i = 0, str = ""; i < len; i++) str += NUMERALS.charAt(xd[i]);
        if (isExp) {
          if (len > 1) {
            if (baseOut == 16 || baseOut == 8) {
              i = baseOut == 16 ? 4 : 3;
              for (--len; len % i; len++) str += "0";
              xd = convertBase(str, base, baseOut);
              for (len = xd.length; !xd[len - 1]; --len) ;
              for (i = 1, str = "1."; i < len; i++) str += NUMERALS.charAt(xd[i]);
            } else {
              str = str.charAt(0) + "." + str.slice(1);
            }
          }
          str = str + (e < 0 ? "p" : "p+") + e;
        } else if (e < 0) {
          for (; ++e; ) str = "0" + str;
          str = "0." + str;
        } else {
          if (++e > len) for (e -= len; e--; ) str += "0";
          else if (e < len) str = str.slice(0, e) + "." + str.slice(e);
        }
      }
      str = (baseOut == 16 ? "0x" : baseOut == 2 ? "0b" : baseOut == 8 ? "0o" : "") + str;
    }
    return x.s < 0 ? "-" + str : str;
  }
  function truncate(arr, len) {
    if (arr.length > len) {
      arr.length = len;
      return true;
    }
  }
  function abs(x) {
    return new this(x).abs();
  }
  function acos(x) {
    return new this(x).acos();
  }
  function acosh(x) {
    return new this(x).acosh();
  }
  function add(x, y) {
    return new this(x).plus(y);
  }
  function asin(x) {
    return new this(x).asin();
  }
  function asinh(x) {
    return new this(x).asinh();
  }
  function atan(x) {
    return new this(x).atan();
  }
  function atanh(x) {
    return new this(x).atanh();
  }
  function atan2(y, x) {
    y = new this(y);
    x = new this(x);
    var r, pr = this.precision, rm = this.rounding, wpr = pr + 4;
    if (!y.s || !x.s) {
      r = new this(NaN);
    } else if (!y.d && !x.d) {
      r = getPi(this, wpr, 1).times(x.s > 0 ? 0.25 : 0.75);
      r.s = y.s;
    } else if (!x.d || y.isZero()) {
      r = x.s < 0 ? getPi(this, pr, rm) : new this(0);
      r.s = y.s;
    } else if (!y.d || x.isZero()) {
      r = getPi(this, wpr, 1).times(0.5);
      r.s = y.s;
    } else if (x.s < 0) {
      this.precision = wpr;
      this.rounding = 1;
      r = this.atan(divide(y, x, wpr, 1));
      x = getPi(this, wpr, 1);
      this.precision = pr;
      this.rounding = rm;
      r = y.s < 0 ? r.minus(x) : r.plus(x);
    } else {
      r = this.atan(divide(y, x, wpr, 1));
    }
    return r;
  }
  function cbrt(x) {
    return new this(x).cbrt();
  }
  function ceil(x) {
    return finalise(x = new this(x), x.e + 1, 2);
  }
  function clamp(x, min2, max2) {
    return new this(x).clamp(min2, max2);
  }
  function config(obj) {
    if (!obj || typeof obj !== "object") throw Error(decimalError + "Object expected");
    var i, p, v, useDefaults = obj.defaults === true, ps = [
      "precision",
      1,
      MAX_DIGITS,
      "rounding",
      0,
      8,
      "toExpNeg",
      -EXP_LIMIT,
      0,
      "toExpPos",
      0,
      EXP_LIMIT,
      "maxE",
      0,
      EXP_LIMIT,
      "minE",
      -EXP_LIMIT,
      0,
      "modulo",
      0,
      9
    ];
    for (i = 0; i < ps.length; i += 3) {
      if (p = ps[i], useDefaults) this[p] = DEFAULTS[p];
      if ((v = obj[p]) !== void 0) {
        if (mathfloor(v) === v && v >= ps[i + 1] && v <= ps[i + 2]) this[p] = v;
        else throw Error(invalidArgument + p + ": " + v);
      }
    }
    if (p = "crypto", useDefaults) this[p] = DEFAULTS[p];
    if ((v = obj[p]) !== void 0) {
      if (v === true || v === false || v === 0 || v === 1) {
        if (v) {
          if (typeof crypto != "undefined" && crypto && (crypto.getRandomValues || crypto.randomBytes)) {
            this[p] = true;
          } else {
            throw Error(cryptoUnavailable);
          }
        } else {
          this[p] = false;
        }
      } else {
        throw Error(invalidArgument + p + ": " + v);
      }
    }
    return this;
  }
  function cos(x) {
    return new this(x).cos();
  }
  function cosh(x) {
    return new this(x).cosh();
  }
  function clone(obj) {
    var i, p, ps;
    function Decimal3(v) {
      var e, i2, t, x = this;
      if (!(x instanceof Decimal3)) return new Decimal3(v);
      x.constructor = Decimal3;
      if (isDecimalInstance(v)) {
        x.s = v.s;
        if (external) {
          if (!v.d || v.e > Decimal3.maxE) {
            x.e = NaN;
            x.d = null;
          } else if (v.e < Decimal3.minE) {
            x.e = 0;
            x.d = [0];
          } else {
            x.e = v.e;
            x.d = v.d.slice();
          }
        } else {
          x.e = v.e;
          x.d = v.d ? v.d.slice() : v.d;
        }
        return;
      }
      t = typeof v;
      if (t === "number") {
        if (v === 0) {
          x.s = 1 / v < 0 ? -1 : 1;
          x.e = 0;
          x.d = [0];
          return;
        }
        if (v < 0) {
          v = -v;
          x.s = -1;
        } else {
          x.s = 1;
        }
        if (v === ~~v && v < 1e7) {
          for (e = 0, i2 = v; i2 >= 10; i2 /= 10) e++;
          if (external) {
            if (e > Decimal3.maxE) {
              x.e = NaN;
              x.d = null;
            } else if (e < Decimal3.minE) {
              x.e = 0;
              x.d = [0];
            } else {
              x.e = e;
              x.d = [v];
            }
          } else {
            x.e = e;
            x.d = [v];
          }
          return;
        }
        if (v * 0 !== 0) {
          if (!v) x.s = NaN;
          x.e = NaN;
          x.d = null;
          return;
        }
        return parseDecimal(x, v.toString());
      }
      if (t === "string") {
        if ((i2 = v.charCodeAt(0)) === 45) {
          v = v.slice(1);
          x.s = -1;
        } else {
          if (i2 === 43) v = v.slice(1);
          x.s = 1;
        }
        return isDecimal.test(v) ? parseDecimal(x, v) : parseOther(x, v);
      }
      if (t === "bigint") {
        if (v < 0) {
          v = -v;
          x.s = -1;
        } else {
          x.s = 1;
        }
        return parseDecimal(x, v.toString());
      }
      throw Error(invalidArgument + v);
    }
    Decimal3.prototype = P;
    Decimal3.ROUND_UP = 0;
    Decimal3.ROUND_DOWN = 1;
    Decimal3.ROUND_CEIL = 2;
    Decimal3.ROUND_FLOOR = 3;
    Decimal3.ROUND_HALF_UP = 4;
    Decimal3.ROUND_HALF_DOWN = 5;
    Decimal3.ROUND_HALF_EVEN = 6;
    Decimal3.ROUND_HALF_CEIL = 7;
    Decimal3.ROUND_HALF_FLOOR = 8;
    Decimal3.EUCLID = 9;
    Decimal3.config = Decimal3.set = config;
    Decimal3.clone = clone;
    Decimal3.isDecimal = isDecimalInstance;
    Decimal3.abs = abs;
    Decimal3.acos = acos;
    Decimal3.acosh = acosh;
    Decimal3.add = add;
    Decimal3.asin = asin;
    Decimal3.asinh = asinh;
    Decimal3.atan = atan;
    Decimal3.atanh = atanh;
    Decimal3.atan2 = atan2;
    Decimal3.cbrt = cbrt;
    Decimal3.ceil = ceil;
    Decimal3.clamp = clamp;
    Decimal3.cos = cos;
    Decimal3.cosh = cosh;
    Decimal3.div = div;
    Decimal3.exp = exp;
    Decimal3.floor = floor;
    Decimal3.hypot = hypot;
    Decimal3.ln = ln;
    Decimal3.log = log;
    Decimal3.log10 = log10;
    Decimal3.log2 = log2;
    Decimal3.max = max;
    Decimal3.min = min;
    Decimal3.mod = mod;
    Decimal3.mul = mul;
    Decimal3.pow = pow;
    Decimal3.random = random;
    Decimal3.round = round;
    Decimal3.sign = sign;
    Decimal3.sin = sin;
    Decimal3.sinh = sinh;
    Decimal3.sqrt = sqrt;
    Decimal3.sub = sub;
    Decimal3.sum = sum;
    Decimal3.tan = tan;
    Decimal3.tanh = tanh;
    Decimal3.trunc = trunc;
    if (obj === void 0) obj = {};
    if (obj) {
      if (obj.defaults !== true) {
        ps = ["precision", "rounding", "toExpNeg", "toExpPos", "maxE", "minE", "modulo", "crypto"];
        for (i = 0; i < ps.length; ) if (!obj.hasOwnProperty(p = ps[i++])) obj[p] = this[p];
      }
    }
    Decimal3.config(obj);
    return Decimal3;
  }
  function div(x, y) {
    return new this(x).div(y);
  }
  function exp(x) {
    return new this(x).exp();
  }
  function floor(x) {
    return finalise(x = new this(x), x.e + 1, 3);
  }
  function hypot() {
    var i, n, t = new this(0);
    external = false;
    for (i = 0; i < arguments.length; ) {
      n = new this(arguments[i++]);
      if (!n.d) {
        if (n.s) {
          external = true;
          return new this(1 / 0);
        }
        t = n;
      } else if (t.d) {
        t = t.plus(n.times(n));
      }
    }
    external = true;
    return t.sqrt();
  }
  function isDecimalInstance(obj) {
    return obj instanceof Decimal || obj && obj.toStringTag === tag || false;
  }
  function ln(x) {
    return new this(x).ln();
  }
  function log(x, y) {
    return new this(x).log(y);
  }
  function log2(x) {
    return new this(x).log(2);
  }
  function log10(x) {
    return new this(x).log(10);
  }
  function max() {
    return maxOrMin(this, arguments, -1);
  }
  function min() {
    return maxOrMin(this, arguments, 1);
  }
  function mod(x, y) {
    return new this(x).mod(y);
  }
  function mul(x, y) {
    return new this(x).mul(y);
  }
  function pow(x, y) {
    return new this(x).pow(y);
  }
  function random(sd) {
    var d2, e, k, n, i = 0, r = new this(1), rd = [];
    if (sd === void 0) sd = this.precision;
    else checkInt32(sd, 1, MAX_DIGITS);
    k = Math.ceil(sd / LOG_BASE);
    if (!this.crypto) {
      for (; i < k; ) rd[i++] = Math.random() * 1e7 | 0;
    } else if (crypto.getRandomValues) {
      d2 = crypto.getRandomValues(new Uint32Array(k));
      for (; i < k; ) {
        n = d2[i];
        if (n >= 429e7) {
          d2[i] = crypto.getRandomValues(new Uint32Array(1))[0];
        } else {
          rd[i++] = n % 1e7;
        }
      }
    } else if (crypto.randomBytes) {
      d2 = crypto.randomBytes(k *= 4);
      for (; i < k; ) {
        n = d2[i] + (d2[i + 1] << 8) + (d2[i + 2] << 16) + ((d2[i + 3] & 127) << 24);
        if (n >= 214e7) {
          crypto.randomBytes(4).copy(d2, i);
        } else {
          rd.push(n % 1e7);
          i += 4;
        }
      }
      i = k / 4;
    } else {
      throw Error(cryptoUnavailable);
    }
    k = rd[--i];
    sd %= LOG_BASE;
    if (k && sd) {
      n = mathpow(10, LOG_BASE - sd);
      rd[i] = (k / n | 0) * n;
    }
    for (; rd[i] === 0; i--) rd.pop();
    if (i < 0) {
      e = 0;
      rd = [0];
    } else {
      e = -1;
      for (; rd[0] === 0; e -= LOG_BASE) rd.shift();
      for (k = 1, n = rd[0]; n >= 10; n /= 10) k++;
      if (k < LOG_BASE) e -= LOG_BASE - k;
    }
    r.e = e;
    r.d = rd;
    return r;
  }
  function round(x) {
    return finalise(x = new this(x), x.e + 1, this.rounding);
  }
  function sign(x) {
    x = new this(x);
    return x.d ? x.d[0] ? x.s : 0 * x.s : x.s || NaN;
  }
  function sin(x) {
    return new this(x).sin();
  }
  function sinh(x) {
    return new this(x).sinh();
  }
  function sqrt(x) {
    return new this(x).sqrt();
  }
  function sub(x, y) {
    return new this(x).sub(y);
  }
  function sum() {
    var i = 0, args = arguments, x = new this(args[i]);
    external = false;
    for (; x.s && ++i < args.length; ) x = x.plus(args[i]);
    external = true;
    return finalise(x, this.precision, this.rounding);
  }
  function tan(x) {
    return new this(x).tan();
  }
  function tanh(x) {
    return new this(x).tanh();
  }
  function trunc(x) {
    return finalise(x = new this(x), x.e + 1, 1);
  }
  P[Symbol.for("nodejs.util.inspect.custom")] = P.toString;
  P[Symbol.toStringTag] = "Decimal";
  var Decimal = P.constructor = clone(DEFAULTS);
  LN10 = new Decimal(LN10);
  PI = new Decimal(PI);
  var decimal_default = Decimal;

  // ../core/src/decimal.ts
  decimal_default.set({
    precision: 20,
    rounding: decimal_default.ROUND_HALF_UP
  });
  function d(value) {
    return new decimal_default(value);
  }
  function roundCents(value) {
    return value.toDecimalPlaces(2, decimal_default.ROUND_HALF_UP);
  }
  var ZERO = new decimal_default(0);

  // ../core/src/audit.ts
  var AuditLog = class {
    constructor(idGen) {
      this.idGen = idGen;
    }
    entries = [];
    emit(type, at, message, opts = {}) {
      this.entries.push({
        eventId: this.idGen.next("audit"),
        type,
        at,
        message,
        rowKey: opts.rowKey,
        saleRowKey: opts.saleRowKey,
        lotFragmentId: opts.lotFragmentId,
        relatedFragmentId: opts.relatedFragmentId,
        payload: opts.payload ?? {}
      });
    }
    getEntries() {
      return [...this.entries];
    }
  };

  // ../core/src/errors.ts
  var ValidationError = class extends Error {
    constructor(message, field, rowIndex) {
      super(message);
      this.field = field;
      this.rowIndex = rowIndex;
      this.name = "ValidationError";
    }
  };
  var LotIdentificationError = class extends Error {
    constructor(message, saleRowKey) {
      super(message);
      this.saleRowKey = saleRowKey;
      this.name = "LotIdentificationError";
    }
  };
  var InsufficientSharesError = class extends Error {
    constructor(message, saleRowKey, requestedShares, availableShares) {
      super(message);
      this.saleRowKey = saleRowKey;
      this.requestedShares = requestedShares;
      this.availableShares = availableShares;
      this.name = "InsufficientSharesError";
    }
  };

  // ../core/src/phases/a-normalize.ts
  var VALID_TRANSACTION_TYPES = [
    "RSU_VEST",
    "SELL_TO_COVER",
    "IPO_SALE",
    "OPEN_MARKET_SALE",
    "ESPP_PURCHASE",
    "ESPP_SALE"
  ];
  var ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  function validateDate(value, field, rowIdx) {
    if (!ISO_DATE_RE.test(value)) {
      throw new ValidationError(
        `Invalid date "${value}" for field "${field}" in row ${rowIdx}. Expected YYYY-MM-DD.`,
        field,
        rowIdx
      );
    }
    const d2 = /* @__PURE__ */ new Date(value + "T00:00:00Z");
    if (isNaN(d2.getTime())) {
      throw new ValidationError(
        `Invalid date "${value}" for field "${field}" in row ${rowIdx}.`,
        field,
        rowIdx
      );
    }
  }
  function validateDecimalString(value, field, rowIdx) {
    try {
      const dec = new decimal_default(value);
      if (!dec.isFinite()) {
        throw new Error("not finite");
      }
      return dec;
    } catch {
      throw new ValidationError(
        `Invalid number "${value}" for field "${field}" in row ${rowIdx}.`,
        field,
        rowIdx
      );
    }
  }
  function actionPrecedence(action) {
    return action === "BUY" ? 0 : 1;
  }
  function normalizeRows(ticker, rows, audit) {
    if (!ticker || ticker.trim().length === 0) {
      throw new ValidationError("Ticker must be a non-empty string.", "ticker");
    }
    if (rows.length === 0) {
      throw new ValidationError("At least one row is required.", "rows");
    }
    const validated = rows.map((row, idx) => {
      validateDate(row.date, "date", idx);
      validateDate(row.acquiredDate, "acquiredDate", idx);
      if (!VALID_TRANSACTION_TYPES.includes(row.transactionType)) {
        throw new ValidationError(
          `Invalid transactionType "${row.transactionType}" in row ${idx}. Must be one of: ${VALID_TRANSACTION_TYPES.join(", ")}.`,
          "transactionType",
          idx
        );
      }
      if (row.action !== "BUY" && row.action !== "SELL") {
        throw new ValidationError(
          `Invalid action "${row.action}" in row ${idx}. Must be "BUY" or "SELL".`,
          "action",
          idx
        );
      }
      const shares = validateDecimalString(row.shares, "shares", idx);
      if (shares.lte(0)) {
        throw new ValidationError(
          `Shares must be positive in row ${idx}, got "${row.shares}".`,
          "shares",
          idx
        );
      }
      const pricePerShare = validateDecimalString(row.pricePerShare, "pricePerShare", idx);
      if (pricePerShare.lt(0)) {
        throw new ValidationError(
          `Price per share must be non-negative in row ${idx}, got "${row.pricePerShare}".`,
          "pricePerShare",
          idx
        );
      }
      return {
        ...row,
        _shares: shares,
        _pricePerShare: pricePerShare,
        _originalIndex: idx
      };
    });
    const sorted = [...validated].sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      const actionCmp = actionPrecedence(a.action) - actionPrecedence(b.action);
      if (actionCmp !== 0) return actionCmp;
      return a._originalIndex - b._originalIndex;
    });
    const groupCounts = /* @__PURE__ */ new Map();
    const normalized = sorted.map((row) => {
      const groupKey = `${row.date}_${row.action.toLowerCase()}`;
      const idx = groupCounts.get(groupKey) ?? 0;
      groupCounts.set(groupKey, idx + 1);
      const rowKey = `${row.date}_${row.action.toLowerCase()}_${idx}`;
      const sortKey = `${row.date}_${actionPrecedence(row.action)}_${String(idx).padStart(4, "0")}`;
      const normalizedRow = {
        rowKey,
        ticker,
        date: row.date,
        action: row.action,
        source: row.source,
        shares: row._shares,
        pricePerShare: row._pricePerShare,
        transactionType: row.transactionType,
        acquiredDate: row.acquiredDate,
        sortKey
      };
      audit.emit("ROW_NORMALIZED", row.date, `Normalized row ${rowKey}`, {
        rowKey,
        payload: {
          action: row.action,
          shares: row._shares.toString(),
          pricePerShare: row._pricePerShare.toString(),
          source: row.source,
          transactionType: row.transactionType
        }
      });
      return normalizedRow;
    });
    return normalized;
  }

  // ../core/src/phases/c-loss-detection.ts
  function identifyLossPortions(salePortions, audit) {
    const losses = salePortions.filter((sp) => sp.gainLoss.isNegative());
    const sorted = [...losses].sort((a, b) => {
      const dateCmp = a.saleDate.localeCompare(b.saleDate);
      if (dateCmp !== 0) return dateCmp;
      return a.originalAcquiredDateForOrdering.localeCompare(b.originalAcquiredDateForOrdering);
    });
    for (const sp of sorted) {
      audit.emit(
        "LOSS_DETECTED",
        sp.saleDate,
        `Loss of ${sp.gainLoss.toString()} detected on sale ${sp.saleRowKey} (${sp.shares.toString()} shares from ${sp.soldFromFragmentId})`,
        {
          saleRowKey: sp.saleRowKey,
          lotFragmentId: sp.soldFromFragmentId,
          payload: {
            shares: sp.shares.toString(),
            basisPerShare: sp.basisPerShareAtSale.toString(),
            salePrice: sp.salePricePerShare.toString(),
            gainLoss: sp.gainLoss.toString()
          }
        }
      );
    }
    return sorted;
  }

  // ../core/src/phases/d-replacement-match.ts
  function daysBetween(dateA, dateB) {
    const a = /* @__PURE__ */ new Date(dateA + "T00:00:00Z");
    const b = /* @__PURE__ */ new Date(dateB + "T00:00:00Z");
    return Math.round((b.getTime() - a.getTime()) / (1e3 * 60 * 60 * 24));
  }
  function addDays(date, days) {
    const d2 = /* @__PURE__ */ new Date(date + "T00:00:00Z");
    d2.setUTCDate(d2.getUTCDate() + days);
    return d2.toISOString().slice(0, 10);
  }
  function isSameOriginAsLossSale(lossPortion, candidateFragment, allFragments) {
    const soldFragment = allFragments.find((f) => f.fragmentId === lossPortion.soldFromFragmentId);
    if (!soldFragment) return false;
    return candidateFragment.originRowKey === soldFragment.originRowKey;
  }
  function getAvailableForReplacement(frag) {
    const available = frag.sharesOpen.minus(frag.consumedAsReplacement);
    return available.gt(0) ? available : ZERO;
  }
  function allocateReplacements(lossPortions, fragments, ticker, _normalizedRows, idGen, audit) {
    const matches = [];
    for (const lossPortion of lossPortions) {
      const windowStart = addDays(lossPortion.saleDate, -30);
      const windowEnd = addDays(lossPortion.saleDate, 30);
      const eligible = fragments.filter((f) => {
        if (f.ticker !== ticker) return false;
        if (f.purchaseDateActual < windowStart) return false;
        if (f.purchaseDateActual > windowEnd) return false;
        if (getAvailableForReplacement(f).lte(0)) return false;
        if (isSameOriginAsLossSale(lossPortion, f, fragments)) return false;
        return true;
      }).sort((a, b) => {
        const dateCmp = a.purchaseDateActual.localeCompare(b.purchaseDateActual);
        if (dateCmp !== 0) return dateCmp;
        return a.fragmentId.localeCompare(b.fragmentId);
      });
      let lossSharesRemaining = lossPortion.shares;
      const disallowedLossPerShare = lossPortion.basisPerShareAtSale.minus(
        lossPortion.salePricePerShare
      );
      for (const replacementFrag of eligible) {
        if (lossSharesRemaining.lte(0)) break;
        const availableForMatch = getAvailableForReplacement(replacementFrag);
        if (availableForMatch.lte(0)) continue;
        const sharesToMatch = decimal_default.min(lossSharesRemaining, availableForMatch);
        const holdingDays = daysBetween(
          lossPortion.originalAcquiredDateForOrdering,
          lossPortion.saleDate
        );
        const match = {
          matchId: idGen.next("match"),
          salePortionId: lossPortion.salePortionId,
          replacementFragmentId: replacementFrag.fragmentId,
          matchedShares: sharesToMatch,
          disallowedLossPerShare,
          disallowedLossTotal: disallowedLossPerShare.mul(sharesToMatch),
          holdingPeriodDaysCarried: holdingDays
        };
        matches.push(match);
        replacementFrag.consumedAsReplacement = replacementFrag.consumedAsReplacement.plus(sharesToMatch);
        lossSharesRemaining = lossSharesRemaining.minus(sharesToMatch);
        audit.emit(
          "REPLACEMENT_MATCHED",
          lossPortion.saleDate,
          `Matched ${sharesToMatch.toString()} replacement shares from ${replacementFrag.fragmentId} for loss on ${lossPortion.saleRowKey}`,
          {
            saleRowKey: lossPortion.saleRowKey,
            lotFragmentId: replacementFrag.fragmentId,
            payload: {
              matchedShares: sharesToMatch.toString(),
              disallowedLossPerShare: disallowedLossPerShare.toString(),
              disallowedLossTotal: disallowedLossPerShare.mul(sharesToMatch).toString(),
              holdingPeriodDaysCarried: holdingDays
            }
          }
        );
      }
    }
    return matches;
  }

  // ../core/src/phases/e-basis-adjust.ts
  function applyAdjustments(matches, fragments, idGen, audit) {
    const matchesByFragment = /* @__PURE__ */ new Map();
    for (const match of matches) {
      const existing = matchesByFragment.get(match.replacementFragmentId) ?? [];
      existing.push(match);
      matchesByFragment.set(match.replacementFragmentId, existing);
    }
    for (const [fragmentId, fragMatches] of matchesByFragment) {
      const fragIndex = fragments.findIndex((f) => f.fragmentId === fragmentId);
      if (fragIndex === -1) continue;
      const frag = fragments[fragIndex];
      const totalMatched = fragMatches.reduce((sum2, m) => sum2.plus(m.matchedShares), ZERO);
      const hasMultipleDifferentAdjustments = fragMatches.length > 1 && new Set(fragMatches.map((m) => m.disallowedLossPerShare.toString())).size > 1;
      if (!hasMultipleDifferentAdjustments && fragMatches.length === 1 && totalMatched.lt(frag.sharesOpen)) {
        const match = fragMatches[0];
        if (match.disallowedLossPerShare.lte(0)) continue;
        const unadjustedShares = frag.sharesOpen.minus(totalMatched);
        const remainder = {
          fragmentId: idGen.next("frag"),
          originRowKey: frag.originRowKey,
          ticker: frag.ticker,
          source: frag.source,
          sharesOpen: unadjustedShares,
          purchaseDateActual: frag.purchaseDateActual,
          acquisitionDateAdjusted: frag.acquisitionDateAdjusted,
          basisPerShareAdjusted: frag.basisPerShareAdjusted,
          originalBasisPerShare: frag.originalBasisPerShare,
          washAdjustmentHistory: [...frag.washAdjustmentHistory],
          consumedAsReplacement: ZERO
        };
        fragments.push(remainder);
        audit.emit(
          "LOT_SPLIT",
          frag.purchaseDateActual,
          `Split ${frag.fragmentId}: ${totalMatched.toString()} shares adjusted, ${unadjustedShares.toString()} shares unadjusted \u2192 ${remainder.fragmentId}`,
          {
            lotFragmentId: frag.fragmentId,
            relatedFragmentId: remainder.fragmentId,
            payload: {
              adjustedShares: totalMatched.toString(),
              unadjustedShares: unadjustedShares.toString()
            }
          }
        );
        frag.sharesOpen = totalMatched;
        frag.consumedAsReplacement = totalMatched;
        frag.basisPerShareAdjusted = frag.basisPerShareAdjusted.plus(match.disallowedLossPerShare);
        frag.acquisitionDateAdjusted = addDays(
          frag.purchaseDateActual,
          -match.holdingPeriodDaysCarried
        );
        frag.washAdjustmentHistory = [
          ...frag.washAdjustmentHistory,
          {
            matchId: match.matchId,
            disallowedLossPerShare: match.disallowedLossPerShare,
            fromSaleRowKey: match.salePortionId,
            appliedAt: frag.purchaseDateActual
          }
        ];
        audit.emit(
          "BASIS_ADJUSTED",
          frag.purchaseDateActual,
          `Adjusted basis of ${frag.fragmentId} by +${match.disallowedLossPerShare.toString()}/share \u2192 ${frag.basisPerShareAdjusted.toString()}/share`,
          {
            lotFragmentId: frag.fragmentId,
            payload: {
              disallowedLossPerShare: match.disallowedLossPerShare.toString(),
              newBasisPerShare: frag.basisPerShareAdjusted.toString(),
              matchId: match.matchId
            }
          }
        );
        audit.emit(
          "ACQ_DATE_ADJUSTED",
          frag.purchaseDateActual,
          `Adjusted acquisition date of ${frag.fragmentId} to ${frag.acquisitionDateAdjusted} (carried ${match.holdingPeriodDaysCarried} days)`,
          {
            lotFragmentId: frag.fragmentId,
            payload: {
              originalAcqDate: frag.purchaseDateActual,
              adjustedAcqDate: frag.acquisitionDateAdjusted,
              holdingPeriodDaysCarried: match.holdingPeriodDaysCarried
            }
          }
        );
      } else {
        let workingFrag = frag;
        for (const match of fragMatches) {
          if (match.disallowedLossPerShare.lte(0)) continue;
          const sharesToTake = match.matchedShares;
          if (sharesToTake.lt(workingFrag.sharesOpen)) {
            const adjustedFrag = {
              fragmentId: idGen.next("frag"),
              originRowKey: workingFrag.originRowKey,
              ticker: workingFrag.ticker,
              source: workingFrag.source,
              sharesOpen: sharesToTake,
              purchaseDateActual: workingFrag.purchaseDateActual,
              acquisitionDateAdjusted: workingFrag.acquisitionDateAdjusted,
              basisPerShareAdjusted: workingFrag.basisPerShareAdjusted.plus(
                match.disallowedLossPerShare
              ),
              originalBasisPerShare: workingFrag.originalBasisPerShare,
              washAdjustmentHistory: [
                ...workingFrag.washAdjustmentHistory,
                {
                  matchId: match.matchId,
                  disallowedLossPerShare: match.disallowedLossPerShare,
                  fromSaleRowKey: match.salePortionId,
                  appliedAt: workingFrag.purchaseDateActual
                }
              ],
              consumedAsReplacement: sharesToTake
            };
            adjustedFrag.acquisitionDateAdjusted = addDays(
              workingFrag.purchaseDateActual,
              -match.holdingPeriodDaysCarried
            );
            fragments.push(adjustedFrag);
            audit.emit(
              "LOT_SPLIT",
              workingFrag.purchaseDateActual,
              `Split ${workingFrag.fragmentId}: ${sharesToTake.toString()} shares adjusted (\u2192 ${adjustedFrag.fragmentId}), ${workingFrag.sharesOpen.minus(sharesToTake).toString()} remainder`,
              {
                lotFragmentId: workingFrag.fragmentId,
                relatedFragmentId: adjustedFrag.fragmentId,
                payload: {
                  adjustedShares: sharesToTake.toString(),
                  disallowedLossPerShare: match.disallowedLossPerShare.toString(),
                  remainderShares: workingFrag.sharesOpen.minus(sharesToTake).toString()
                }
              }
            );
            audit.emit(
              "BASIS_ADJUSTED",
              workingFrag.purchaseDateActual,
              `Adjusted basis of ${adjustedFrag.fragmentId} by +${match.disallowedLossPerShare.toString()}/share \u2192 ${adjustedFrag.basisPerShareAdjusted.toString()}/share`,
              {
                lotFragmentId: adjustedFrag.fragmentId,
                payload: {
                  disallowedLossPerShare: match.disallowedLossPerShare.toString(),
                  newBasisPerShare: adjustedFrag.basisPerShareAdjusted.toString(),
                  matchId: match.matchId
                }
              }
            );
            audit.emit(
              "ACQ_DATE_ADJUSTED",
              workingFrag.purchaseDateActual,
              `Adjusted acquisition date of ${adjustedFrag.fragmentId} to ${adjustedFrag.acquisitionDateAdjusted} (carried ${match.holdingPeriodDaysCarried} days)`,
              {
                lotFragmentId: adjustedFrag.fragmentId,
                payload: {
                  originalAcqDate: workingFrag.purchaseDateActual,
                  adjustedAcqDate: adjustedFrag.acquisitionDateAdjusted,
                  holdingPeriodDaysCarried: match.holdingPeriodDaysCarried
                }
              }
            );
            workingFrag.sharesOpen = workingFrag.sharesOpen.minus(sharesToTake);
            workingFrag.consumedAsReplacement = workingFrag.consumedAsReplacement.minus(sharesToTake);
          } else {
            workingFrag.basisPerShareAdjusted = workingFrag.basisPerShareAdjusted.plus(
              match.disallowedLossPerShare
            );
            workingFrag.acquisitionDateAdjusted = addDays(
              workingFrag.purchaseDateActual,
              -match.holdingPeriodDaysCarried
            );
            workingFrag.washAdjustmentHistory = [
              ...workingFrag.washAdjustmentHistory,
              {
                matchId: match.matchId,
                disallowedLossPerShare: match.disallowedLossPerShare,
                fromSaleRowKey: match.salePortionId,
                appliedAt: workingFrag.purchaseDateActual
              }
            ];
            if (fragMatches.length === 1) {
              workingFrag.consumedAsReplacement = totalMatched;
            }
            audit.emit(
              "BASIS_ADJUSTED",
              workingFrag.purchaseDateActual,
              `Adjusted basis of ${workingFrag.fragmentId} by +${match.disallowedLossPerShare.toString()}/share \u2192 ${workingFrag.basisPerShareAdjusted.toString()}/share`,
              {
                lotFragmentId: workingFrag.fragmentId,
                payload: {
                  disallowedLossPerShare: match.disallowedLossPerShare.toString(),
                  newBasisPerShare: workingFrag.basisPerShareAdjusted.toString(),
                  matchId: match.matchId
                }
              }
            );
            audit.emit(
              "ACQ_DATE_ADJUSTED",
              workingFrag.purchaseDateActual,
              `Adjusted acquisition date of ${workingFrag.fragmentId} to ${workingFrag.acquisitionDateAdjusted} (carried ${match.holdingPeriodDaysCarried} days)`,
              {
                lotFragmentId: workingFrag.fragmentId,
                payload: {
                  originalAcqDate: workingFrag.purchaseDateActual,
                  adjustedAcqDate: workingFrag.acquisitionDateAdjusted,
                  holdingPeriodDaysCarried: match.holdingPeriodDaysCarried
                }
              }
            );
          }
        }
      }
    }
  }

  // ../core/src/phases/g-output.ts
  function daysBetween2(dateA, dateB) {
    const a = /* @__PURE__ */ new Date(dateA + "T00:00:00Z");
    const b = /* @__PURE__ */ new Date(dateB + "T00:00:00Z");
    return Math.round((b.getTime() - a.getTime()) / (1e3 * 60 * 60 * 24));
  }
  function determineTerm(acquiredDate, soldDate) {
    const days = daysBetween2(acquiredDate, soldDate);
    return days > 365 ? "LONG" : "SHORT";
  }
  function consolidateRows(rows, ticker, audit) {
    const keyOf = (r) => `${r.dateAcquired}|${r.dateSold}|${r.adjustmentCode ?? ""}`;
    const grouped = /* @__PURE__ */ new Map();
    for (const row of rows) {
      const key = keyOf(row);
      const bucket = grouped.get(key);
      if (bucket) {
        bucket.push(row);
      } else {
        grouped.set(key, [row]);
      }
    }
    const result = [];
    for (const bucket of grouped.values()) {
      if (bucket.length === 1) {
        result.push(bucket[0]);
        continue;
      }
      let totalShares = ZERO;
      let totalProceeds = ZERO;
      let totalCostBasis = ZERO;
      let totalAdjustment = ZERO;
      let totalGainOrLoss = ZERO;
      const { dateAcquired, dateSold, adjustmentCode, term } = bucket[0];
      const sourceDescriptions = [];
      for (const row of bucket) {
        const shares = d(row.description.split(" ")[0]);
        totalShares = totalShares.plus(shares);
        totalProceeds = totalProceeds.plus(row.proceeds);
        totalCostBasis = totalCostBasis.plus(row.costBasis);
        totalAdjustment = totalAdjustment.plus(row.adjustmentAmount ?? ZERO);
        totalGainOrLoss = totalGainOrLoss.plus(row.gainOrLoss);
        sourceDescriptions.push(row.description);
      }
      const hasWashSale = adjustmentCode === "W";
      const merged = {
        description: `${totalShares.toString()} sh ${ticker}`,
        dateAcquired,
        dateSold,
        proceeds: roundCents(totalProceeds),
        costBasis: roundCents(totalCostBasis),
        adjustmentCode: hasWashSale ? "W" : void 0,
        adjustmentAmount: hasWashSale ? roundCents(totalAdjustment) : void 0,
        gainOrLoss: roundCents(totalGainOrLoss),
        term
      };
      audit?.emit(
        "ROWS_CONSOLIDATED",
        dateSold,
        `Consolidated ${bucket.length} rows into ${merged.description} (sold ${dateSold}): ${sourceDescriptions.join(" + ")}`,
        {
          payload: {
            mergedCount: bucket.length,
            sourceDescriptions,
            resultDescription: merged.description,
            dateAcquired,
            dateSold
          }
        }
      );
      result.push(merged);
    }
    return result;
  }
  function buildForm8949(ticker, salePortions, matches, fragments, audit) {
    const disallowedBySale = /* @__PURE__ */ new Map();
    for (const match of matches) {
      const current = disallowedBySale.get(match.salePortionId) ?? ZERO;
      disallowedBySale.set(match.salePortionId, current.plus(match.disallowedLossTotal));
    }
    const adjustedDateBySale = /* @__PURE__ */ new Map();
    for (const portion of salePortions) {
      const frag = fragments.find((f) => f.fragmentId === portion.soldFromFragmentId);
      if (frag) {
        adjustedDateBySale.set(portion.salePortionId, frag.acquisitionDateAdjusted);
      }
    }
    const salesWithAdj = salePortions.map((portion) => ({
      portion,
      disallowedTotal: disallowedBySale.get(portion.salePortionId) ?? ZERO,
      adjustedAcquiredDate: adjustedDateBySale.get(portion.salePortionId) ?? portion.originalAcquiredDateForOrdering
    }));
    const shortTermRows = [];
    const longTermRows = [];
    const exportNotes = [];
    for (const sale of salesWithAdj) {
      const { portion, disallowedTotal, adjustedAcquiredDate } = sale;
      const term = determineTerm(adjustedAcquiredDate, portion.saleDate);
      const proceeds = roundCents(portion.proceeds);
      const costBasis = roundCents(portion.shares.mul(portion.basisPerShareAtSale));
      const hasWashSale = disallowedTotal.gt(0);
      const gainOrLoss = hasWashSale ? roundCents(proceeds.minus(costBasis).plus(disallowedTotal)) : roundCents(proceeds.minus(costBasis));
      const row = {
        description: `${portion.shares.toString()} sh ${ticker}`,
        dateAcquired: adjustedAcquiredDate,
        dateSold: portion.saleDate,
        proceeds,
        costBasis,
        adjustmentCode: hasWashSale ? "W" : void 0,
        adjustmentAmount: hasWashSale ? roundCents(disallowedTotal) : void 0,
        gainOrLoss,
        term
      };
      if (term === "SHORT") {
        shortTermRows.push(row);
      } else {
        longTermRows.push(row);
      }
    }
    return {
      shortTermRows: consolidateRows(shortTermRows, ticker, audit),
      longTermRows: consolidateRows(longTermRows, ticker, audit),
      exportNotes
    };
  }
  function buildRemainingPositions(fragments) {
    return fragments.filter((f) => f.sharesOpen.gt(0)).map((f) => ({
      fragmentId: f.fragmentId,
      ticker: f.ticker,
      source: f.source,
      sharesOpen: f.sharesOpen,
      purchaseDateActual: f.purchaseDateActual,
      acquisitionDateAdjusted: f.acquisitionDateAdjusted,
      originalBasisPerShare: f.originalBasisPerShare,
      basisPerShareAdjusted: f.basisPerShareAdjusted,
      washAdjustmentHistory: f.washAdjustmentHistory
    }));
  }
  function buildSummary(salePortions, matches, remainingPositions) {
    const disallowedBySale = /* @__PURE__ */ new Map();
    for (const match of matches) {
      const current = disallowedBySale.get(match.salePortionId) ?? ZERO;
      disallowedBySale.set(match.salePortionId, current.plus(match.disallowedLossTotal));
    }
    let realizedST = ZERO;
    let realizedLT = ZERO;
    let totalDisallowed = ZERO;
    let totalAllowed = ZERO;
    for (const portion of salePortions) {
      const disallowed = disallowedBySale.get(portion.salePortionId) ?? ZERO;
      const allowedGainLoss = portion.gainLoss.plus(disallowed);
      const days = daysBetween2(portion.originalAcquiredDateForOrdering, portion.saleDate);
      if (days > 365) {
        realizedLT = realizedLT.plus(allowedGainLoss);
      } else {
        realizedST = realizedST.plus(allowedGainLoss);
      }
      totalDisallowed = totalDisallowed.plus(disallowed);
      if (portion.gainLoss.isNegative()) {
        const allowedLoss = portion.gainLoss.abs().minus(disallowed);
        if (allowedLoss.gt(0)) {
          totalAllowed = totalAllowed.plus(allowedLoss);
        }
      }
    }
    let deferredInRemaining = ZERO;
    for (const pos of remainingPositions) {
      const adjustmentPerShare = pos.basisPerShareAdjusted.minus(pos.originalBasisPerShare);
      if (adjustmentPerShare.gt(0)) {
        deferredInRemaining = deferredInRemaining.plus(adjustmentPerShare.mul(pos.sharesOpen));
      }
    }
    return {
      realizedGainLossShortTerm: roundCents(realizedST),
      realizedGainLossLongTerm: roundCents(realizedLT),
      totalDisallowedLosses: roundCents(totalDisallowed),
      deferredLossesInRemainingHoldings: roundCents(deferredInRemaining),
      totalAllowedLosses: roundCents(totalAllowed)
    };
  }
  function collectWarnings(salePortions, matches, fragments, normalizedRows) {
    const warnings = [];
    if (normalizedRows && normalizedRows.length > 0) {
      const totalBought = normalizedRows.filter((r) => r.action === "BUY").reduce((sum2, r) => sum2.plus(r.shares), ZERO);
      const totalSold = salePortions.reduce((sum2, p) => sum2.plus(p.shares), ZERO);
      const totalRemaining = fragments.reduce((sum2, f) => sum2.plus(f.sharesOpen), ZERO);
      const expectedTotal = totalSold.plus(totalRemaining);
      if (!totalBought.eq(expectedTotal)) {
        warnings.push({
          code: "SHARE_COUNT_MISMATCH",
          message: `Share count mismatch: bought ${totalBought.toString()}, sold+remaining ${expectedTotal.toString()}`
        });
      }
    }
    for (const frag of fragments) {
      if (frag.sharesOpen.lt(0)) {
        warnings.push({
          code: "NEGATIVE_REMAINING_SHARES",
          message: `Fragment ${frag.fragmentId} has negative remaining shares: ${frag.sharesOpen.toString()}`,
          fragmentId: frag.fragmentId
        });
      }
    }
    for (const match of matches) {
      const frag = fragments.find((f) => f.fragmentId === match.replacementFragmentId);
      if (frag && frag.originalBasisPerShare.gt(0)) {
        const pct = match.disallowedLossPerShare.div(frag.originalBasisPerShare).mul(100);
        if (pct.gt(50)) {
          warnings.push({
            code: "LARGE_WASH_SALE_ADJUSTMENT",
            message: `Wash sale adjustment (${match.disallowedLossPerShare.toString()} per share) exceeds 50% of original basis (${frag.originalBasisPerShare.toString()}) for fragment ${frag.fragmentId}`,
            fragmentId: frag.fragmentId
          });
        }
      }
    }
    return warnings;
  }

  // ../core/src/calculator.ts
  function sortByHifo(fragments) {
    return [...fragments].sort((a, b) => {
      const basisCmp = b.basisPerShareAdjusted.cmp(a.basisPerShareAdjusted);
      if (basisCmp !== 0) return basisCmp;
      const dateCmp = a.purchaseDateActual.localeCompare(b.purchaseDateActual);
      if (dateCmp !== 0) return dateCmp;
      const adjCmp = a.acquisitionDateAdjusted.localeCompare(b.acquisitionDateAdjusted);
      if (adjCmp !== 0) return adjCmp;
      return a.fragmentId.localeCompare(b.fragmentId);
    });
  }
  function findAndSortMatchingFragments(fragments, row) {
    const candidates = fragments.filter((f) => f.ticker === row.ticker && f.sharesOpen.gt(0));
    const byAcqDate = candidates.filter((f) => f.purchaseDateActual === row.acquiredDate);
    if (byAcqDate.length > 0) return sortByHifo(byAcqDate);
    return [...candidates].sort((a, b) => {
      const dateCmp = a.purchaseDateActual.localeCompare(b.purchaseDateActual);
      if (dateCmp !== 0) return dateCmp;
      return a.fragmentId.localeCompare(b.fragmentId);
    });
  }
  function calculate(ticker, rows, idGen) {
    const audit = new AuditLog(idGen);
    const normalizedRows = normalizeRows(ticker, rows, audit);
    const fragments = [];
    const buyRows = normalizedRows.filter((r) => r.action === "BUY");
    for (const row of buyRows) {
      const fragment = {
        fragmentId: idGen.next("frag"),
        originRowKey: row.rowKey,
        ticker: row.ticker,
        source: row.source,
        sharesOpen: row.shares,
        purchaseDateActual: row.date,
        acquisitionDateAdjusted: row.date,
        basisPerShareAdjusted: row.pricePerShare,
        originalBasisPerShare: row.pricePerShare,
        washAdjustmentHistory: [],
        consumedAsReplacement: ZERO
      };
      fragments.push(fragment);
      audit.emit("LOT_CREATED", row.date, `Created lot ${fragment.fragmentId} from ${row.rowKey}`, {
        rowKey: row.rowKey,
        lotFragmentId: fragment.fragmentId,
        payload: {
          shares: row.shares.toString(),
          basisPerShare: row.pricePerShare.toString(),
          purchaseDate: row.date
        }
      });
    }
    const allSalePortions = [];
    const allMatches = [];
    const sellRows = normalizedRows.filter((r) => r.action === "SELL");
    const sellsByDate = /* @__PURE__ */ new Map();
    for (const row of sellRows) {
      const existing = sellsByDate.get(row.date) ?? [];
      existing.push(row);
      sellsByDate.set(row.date, existing);
    }
    const sortedDates = [...sellsByDate.keys()].sort();
    for (const date of sortedDates) {
      const dateSells = sellsByDate.get(date);
      const dateSalePortions = [];
      for (const row of dateSells) {
        const matched = findAndSortMatchingFragments(fragments, row);
        if (matched.length === 0) {
          throw new LotIdentificationError(
            `Cannot identify source lots for sale ${row.rowKey}: no matching open lots found.`,
            row.rowKey
          );
        }
        let sharesToSell = row.shares;
        const totalAvailable = matched.reduce((sum2, f) => sum2.plus(f.sharesOpen), ZERO);
        if (totalAvailable.lt(sharesToSell)) {
          throw new InsufficientSharesError(
            `Insufficient shares for sale ${row.rowKey}: need ${sharesToSell.toString()}, have ${totalAvailable.toString()}.`,
            row.rowKey,
            sharesToSell.toString(),
            totalAvailable.toString()
          );
        }
        for (const frag of matched) {
          if (sharesToSell.lte(0)) break;
          const sharesToTake = decimal_default.min(frag.sharesOpen, sharesToSell);
          const basisAtSale = frag.basisPerShareAdjusted;
          const proceeds = sharesToTake.mul(row.pricePerShare);
          const cost = sharesToTake.mul(basisAtSale);
          const gainLoss = proceeds.minus(cost);
          const portion = {
            salePortionId: idGen.next("sp"),
            saleRowKey: row.rowKey,
            soldFromFragmentId: frag.fragmentId,
            shares: sharesToTake,
            saleDate: row.date,
            salePricePerShare: row.pricePerShare,
            proceeds,
            basisPerShareAtSale: basisAtSale,
            gainLoss,
            originalAcquiredDateForOrdering: frag.purchaseDateActual
          };
          dateSalePortions.push(portion);
          if (sharesToTake.lt(frag.sharesOpen)) {
            audit.emit(
              "LOT_SPLIT",
              row.date,
              `Split ${frag.fragmentId}: sold ${sharesToTake.toString()} of ${frag.sharesOpen.toString()} shares`,
              {
                lotFragmentId: frag.fragmentId,
                saleRowKey: row.rowKey,
                payload: {
                  soldShares: sharesToTake.toString(),
                  remainingShares: frag.sharesOpen.minus(sharesToTake).toString()
                }
              }
            );
          }
          frag.sharesOpen = frag.sharesOpen.minus(sharesToTake);
          sharesToSell = sharesToSell.minus(sharesToTake);
          audit.emit(
            "SALE_PROCESSED",
            row.date,
            `Processed sale of ${sharesToTake.toString()} shares from ${frag.fragmentId}`,
            {
              saleRowKey: row.rowKey,
              lotFragmentId: frag.fragmentId,
              payload: {
                shares: sharesToTake.toString(),
                proceeds: proceeds.toString(),
                basisAtSale: basisAtSale.toString(),
                gainLoss: gainLoss.toString()
              }
            }
          );
        }
      }
      allSalePortions.push(...dateSalePortions);
      const lossPortions = identifyLossPortions(dateSalePortions, audit);
      if (lossPortions.length > 0) {
        const dateMatches = allocateReplacements(
          lossPortions,
          fragments,
          ticker,
          normalizedRows,
          idGen,
          audit
        );
        if (dateMatches.length > 0) {
          allMatches.push(...dateMatches);
          applyAdjustments(dateMatches, fragments, idGen, audit);
        }
      }
    }
    const form8949Data = buildForm8949(ticker, allSalePortions, allMatches, fragments, audit);
    const remainingPositions = buildRemainingPositions(fragments);
    const summary = buildSummary(allSalePortions, allMatches, remainingPositions);
    const warnings = collectWarnings(allSalePortions, allMatches, fragments, normalizedRows);
    return {
      ticker,
      normalizedRows,
      form8949Data,
      remainingPositions,
      summary,
      auditLog: audit.getEntries(),
      warnings
    };
  }

  // ../core/src/id-generator.ts
  var SequentialIdGenerator = class {
    counters = /* @__PURE__ */ new Map();
    next(prefix) {
      const current = this.counters.get(prefix) ?? 0;
      const nextVal = current + 1;
      this.counters.set(prefix, nextVal);
      return `${prefix}_${String(nextVal).padStart(3, "0")}`;
    }
  };

  // ../core/src/builder.ts
  function deepFreeze(obj) {
    if (obj === null || obj === void 0 || typeof obj !== "object") return obj;
    Object.freeze(obj);
    for (const value of Object.values(obj)) {
      if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
        deepFreeze(value);
      }
    }
    return obj;
  }
  var CalculatorBuilderImpl = class {
    constructor(ticker) {
      this.ticker = ticker;
    }
    rows = [];
    calculated = false;
    addRow(row) {
      if (this.calculated) {
        throw new Error("Cannot add rows after calculate() has been called. Create a new calculator.");
      }
      this.rows.push({ ...row });
      return this;
    }
    addRows(rows) {
      for (const row of rows) {
        this.addRow(row);
      }
      return this;
    }
    calculate() {
      if (this.calculated) {
        throw new Error("calculate() has already been called. Create a new calculator.");
      }
      this.calculated = true;
      const idGen = new SequentialIdGenerator();
      const result = calculate(this.ticker, this.rows, idGen);
      return deepFreeze(result);
    }
  };
  var AdjustedCostBasisCalculator = class {
    static forTicker(ticker) {
      return new CalculatorBuilderImpl(ticker);
    }
  };

  // ../adapters/src/csv-parser.ts
  var REQUIRED_COLUMNS = [
    "date",
    "action",
    "source",
    "shares",
    "pricePerShare",
    "transactionType",
    "acquiredDate"
  ];
  var OPTIONAL_COLUMNS = ["notes"];
  var VALID_SOURCES = ["Shareworks", "Computershare", "Other"];
  var VALID_TRANSACTION_TYPES2 = [
    "RSU_VEST",
    "SELL_TO_COVER",
    "IPO_SALE",
    "OPEN_MARKET_SALE",
    "ESPP_PURCHASE",
    "ESPP_SALE"
  ];
  var ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
  var NUMERIC_REGEX = /^-?\d+(\.\d+)?$/;
  function unescapeCsvValue(val) {
    return val.replace(/""/g, '"');
  }
  function parseCsvRows(csvText) {
    const lines = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < csvText.length; i++) {
      const char = csvText[i];
      if (char === '"') {
        if (inQuotes && csvText[i + 1] === '"') {
          current += '""';
          i++;
        } else {
          inQuotes = !inQuotes;
          current += char;
        }
      } else if ((char === "\n" || char === "\r") && !inQuotes) {
        if (current.length > 0) {
          lines.push(current);
          current = "";
        }
        if (char === "\r" && csvText[i + 1] === "\n") i++;
      } else {
        current += char;
      }
    }
    if (current.length > 0) lines.push(current);
    return lines.map((line) => {
      const cells = [];
      let cell = "";
      inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          if (inQuotes && line[i + 1] === '"') {
            cell += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (c === "," && !inQuotes) {
          cells.push(unescapeCsvValue(cell));
          cell = "";
        } else {
          cell += c;
        }
      }
      cells.push(unescapeCsvValue(cell));
      return cells;
    });
  }
  function normalizeHeader(h) {
    return h.trim().toLowerCase();
  }
  function findColumnIndex(headers, columns) {
    const normalized = headers.map(normalizeHeader);
    const map = /* @__PURE__ */ new Map();
    for (const col of columns) {
      const idx = normalized.indexOf(col.toLowerCase());
      if (idx >= 0) map.set(col, idx);
    }
    return map;
  }
  function requireColumn(map, name, headers) {
    const idx = map.get(name);
    if (idx === void 0) {
      throw new Error(
        `CSV parse error: missing required column "${name}". Found columns: ${headers.join(", ") || "(none)"}`
      );
    }
    return idx;
  }
  function validateIsoDate(val, field, rowNum) {
    if (!val || !ISO_DATE_REGEX.test(val)) {
      throw new Error(`CSV parse error: row ${rowNum}: "${field}" must be YYYY-MM-DD, got "${val}"`);
    }
  }
  function validateAction(val, rowNum) {
    const upper = val.toUpperCase().trim();
    if (upper !== "BUY" && upper !== "SELL") {
      throw new Error(`CSV parse error: row ${rowNum}: "action" must be BUY or SELL, got "${val}"`);
    }
    return upper;
  }
  function validateSource(val, rowNum) {
    const trimmed = val.trim();
    if (!VALID_SOURCES.includes(trimmed)) {
      throw new Error(
        `CSV parse error: row ${rowNum}: "source" must be Shareworks, Computershare, or Other, got "${val}"`
      );
    }
    return trimmed;
  }
  function validateDecimalString2(val, field, rowNum) {
    const trimmed = val.trim();
    if (trimmed === "") {
      throw new Error(`CSV parse error: row ${rowNum}: "${field}" is required, got empty value`);
    }
    if (!NUMERIC_REGEX.test(trimmed)) {
      throw new Error(
        `CSV parse error: row ${rowNum}: "${field}" must be a valid number, got "${val}"`
      );
    }
    return trimmed;
  }
  function validateTransactionType(val, rowNum) {
    const trimmed = val.trim();
    if (!trimmed) {
      throw new Error(
        `CSV parse error: row ${rowNum}: "transactionType" is required, got empty value`
      );
    }
    if (!VALID_TRANSACTION_TYPES2.includes(trimmed)) {
      throw new Error(
        `CSV parse error: row ${rowNum}: "transactionType" must be one of ${VALID_TRANSACTION_TYPES2.join(", ")}, got "${val}"`
      );
    }
    return trimmed;
  }
  function parseRows(csvText) {
    const rows = parseCsvRows(csvText);
    if (rows.length === 0) return [];
    const rawHeaders = rows[0];
    const colMap = findColumnIndex(rawHeaders, [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS]);
    for (const req of REQUIRED_COLUMNS) {
      requireColumn(colMap, req, rawHeaders);
    }
    const dateIdx = requireColumn(colMap, "date", rawHeaders);
    const actionIdx = requireColumn(colMap, "action", rawHeaders);
    const sourceIdx = requireColumn(colMap, "source", rawHeaders);
    const sharesIdx = requireColumn(colMap, "shares", rawHeaders);
    const pricePerShareIdx = requireColumn(colMap, "pricePerShare", rawHeaders);
    const transactionTypeIdx = requireColumn(colMap, "transactionType", rawHeaders);
    const acquiredDateIdx = requireColumn(colMap, "acquiredDate", rawHeaders);
    const notesIdx = colMap.get("notes");
    const result = [];
    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i];
      const rowNum = i + 1;
      const dateVal = cells[dateIdx] ?? "";
      const actionVal = cells[actionIdx] ?? "";
      const sourceVal = cells[sourceIdx] ?? "";
      const sharesVal = cells[sharesIdx] ?? "";
      const priceVal = cells[pricePerShareIdx] ?? "";
      validateIsoDate(dateVal, "date", rowNum);
      const action = validateAction(actionVal, rowNum);
      const source = validateSource(sourceVal, rowNum);
      const shares = validateDecimalString2(sharesVal, "shares", rowNum);
      const pricePerShare = validateDecimalString2(priceVal, "pricePerShare", rowNum);
      const transactionTypeVal = cells[transactionTypeIdx] ?? "";
      const acquiredDateVal = cells[acquiredDateIdx] ?? "";
      const transactionType = validateTransactionType(transactionTypeVal, rowNum);
      validateIsoDate(acquiredDateVal, "acquiredDate", rowNum);
      const row = {
        date: dateVal.trim(),
        action,
        source,
        shares,
        pricePerShare,
        transactionType,
        acquiredDate: acquiredDateVal.trim()
      };
      if (notesIdx !== void 0) {
        const n = cells[notesIdx]?.trim();
        if (n) row.notes = n;
      }
      result.push(row);
    }
    return result;
  }

  // ../adapters/src/formatters.ts
  function padRight(s, width) {
    if (s.length >= width) return s;
    return s + " ".repeat(width - s.length);
  }
  function formatForm8949Table(rows) {
    if (rows.length === 0) return "";
    const cols = [
      (r) => r.description,
      (r) => r.dateAcquired,
      (r) => r.dateSold,
      (r) => r.proceeds.toFixed(2),
      (r) => r.costBasis.toFixed(2),
      (r) => r.adjustmentCode ?? "",
      (r) => r.adjustmentAmount != null ? r.adjustmentAmount.toFixed(2) : "",
      (r) => r.gainOrLoss.toFixed(2),
      (r) => r.term
    ];
    const headers = [
      "Description",
      "Acquired",
      "Sold",
      "Proceeds",
      "Basis",
      "Adj Code",
      "Adj Amount",
      "Gain/Loss",
      "Term"
    ];
    const widths = headers.map((h, i) => {
      let max2 = h.length;
      for (const row of rows) {
        const val = cols[i](row);
        if (val.length > max2) max2 = val.length;
      }
      return max2;
    });
    const headerLine = headers.map((h, i) => padRight(h, widths[i])).join("  ");
    const sep = "-".repeat(headerLine.length);
    const dataLines = rows.map((row) => cols.map((fn, i) => padRight(fn(row), widths[i])).join("  "));
    return [headerLine, sep, ...dataLines].join("\n");
  }
  function formatInputTable(rows) {
    if (rows.length === 0) return "(no input rows)";
    const headers = ["Date", "Action", "Source", "Shares", "Price/Share", "Type", "Acquired Date"];
    const cols = [
      (r) => r.date,
      (r) => r.action,
      (r) => r.source,
      (r) => r.shares.toString(),
      (r) => r.pricePerShare.toFixed(2),
      (r) => r.transactionType ?? "",
      (r) => r.acquiredDate ?? ""
    ];
    const widths = headers.map((h, i) => {
      let max2 = h.length;
      for (const row of rows) {
        const val = cols[i](row);
        if (val.length > max2) max2 = val.length;
      }
      return max2;
    });
    const headerLine = headers.map((h, i) => padRight(h, widths[i])).join("  ");
    const sep = "-".repeat(headerLine.length);
    const dataLines = rows.map((row) => cols.map((fn, i) => padRight(fn(row), widths[i])).join("  "));
    return [headerLine, sep, ...dataLines].join("\n");
  }
  var DISCLAIMER_LINES = [
    "DISCLAIMER: This tool is for educational and computational purposes only. It does not constitute tax, legal,",
    "or financial advice. Wash sale rules (IRC \xA71091) have nuances including but not limited to: IRA acquisitions,",
    "options/contracts on substantially identical securities, spousal transactions, and state-specific rules.",
    "Always consult a qualified tax professional for your specific situation."
  ];
  function buildDisclaimer() {
    const maxVisible = DISCLAIMER_LINES.reduce((max2, line) => Math.max(max2, line.length), 0);
    const border = "=".repeat(maxVisible + 4);
    const padded = DISCLAIMER_LINES.map((line) => {
      const pad = maxVisible - line.length;
      return `= ${line}${" ".repeat(pad)} =`;
    });
    return [border, ...padded, border].join("\n");
  }
  function formatAuditTable(auditLog) {
    if (auditLog.length === 0) return "(no audit entries)";
    const headers = ["#", "Type", "Date", "Message"];
    const cols = [
      (_e, i) => String(i + 1),
      (e) => e.type,
      (e) => e.at,
      (e) => e.message
    ];
    const widths = headers.map((h, ci) => {
      let max2 = h.length;
      for (let ri = 0; ri < auditLog.length; ri++) {
        const val = cols[ci](auditLog[ri], ri);
        if (val.length > max2) max2 = val.length;
      }
      return max2;
    });
    const headerLine = headers.map((h, i) => padRight(h, widths[i])).join("  ");
    const sep = "-".repeat(headerLine.length);
    const dataLines = auditLog.map(
      (entry, ri) => cols.map((fn, ci) => padRight(fn(entry, ri), widths[ci])).join("  ")
    );
    return [headerLine, sep, ...dataLines].join("\n");
  }
  function formatResultTable(result, opts) {
    const sections = [];
    const disclaimer = opts?.disclaimerOverride ?? buildDisclaimer();
    sections.push(disclaimer);
    sections.push("");
    sections.push("=== Input Transactions ===");
    sections.push(formatInputTable(result.normalizedRows));
    sections.push("");
    const s = result.summary;
    sections.push("=== Summary ===");
    sections.push(`Realized Gain/Loss (Short-term):  ${s.realizedGainLossShortTerm.toFixed(2)}`);
    sections.push(`Realized Gain/Loss (Long-term):   ${s.realizedGainLossLongTerm.toFixed(2)}`);
    sections.push(`Total Disallowed Losses:          ${s.totalDisallowedLosses.toFixed(2)}`);
    sections.push(
      `Deferred (in remaining):           ${s.deferredLossesInRemainingHoldings.toFixed(2)}`
    );
    sections.push(`Total Allowed Losses:             ${s.totalAllowedLosses.toFixed(2)}`);
    const { form8949Data } = result;
    if (form8949Data.shortTermRows.length > 0) {
      sections.push("");
      sections.push("=== Form 8949 (Short-term) ===");
      sections.push(formatForm8949Table(form8949Data.shortTermRows));
    }
    if (form8949Data.longTermRows.length > 0) {
      sections.push("");
      sections.push("=== Form 8949 (Long-term) ===");
      sections.push(formatForm8949Table(form8949Data.longTermRows));
    }
    if (result.remainingPositions.length > 0) {
      sections.push("");
      sections.push("=== Remaining Positions ===");
      const posHeaders = [
        "Fragment ID",
        "Ticker",
        "Source",
        "Shares",
        "Purchase Date",
        "Adjusted Acq Date",
        "Original Basis/Share",
        "Adjusted Basis/Share"
      ];
      const posCols = [
        (p) => p.fragmentId,
        (p) => p.ticker,
        (p) => p.source,
        (p) => p.sharesOpen.toString(),
        (p) => p.purchaseDateActual,
        (p) => p.acquisitionDateAdjusted,
        (p) => p.originalBasisPerShare.toFixed(2),
        (p) => p.basisPerShareAdjusted.toFixed(2)
      ];
      const posWidths = posHeaders.map((h, i) => {
        let max2 = h.length;
        for (const p of result.remainingPositions) {
          const val = posCols[i](p);
          if (val.length > max2) max2 = val.length;
        }
        return max2;
      });
      const posHeaderLine = posHeaders.map((h, i) => padRight(h, posWidths[i])).join("  ");
      const posSep = "-".repeat(posHeaderLine.length);
      const posDataLines = result.remainingPositions.map(
        (p) => posCols.map((fn, i) => padRight(fn(p), posWidths[i])).join("  ")
      );
      sections.push(posHeaderLine);
      sections.push(posSep);
      sections.push(...posDataLines);
    }
    if (result.warnings.length > 0) {
      sections.push("");
      sections.push("=== Warnings ===");
      for (const w of result.warnings) {
        sections.push(`[${w.code}] ${w.message}`);
      }
    }
    if (opts?.audit) {
      sections.push("");
      sections.push("=== Audit Log ===");
      sections.push(formatAuditTable(result.auditLog));
    }
    return sections.join("\n");
  }

  // src/main.ts
  var screenDisclaimer = document.getElementById("screen-disclaimer");
  var screenInput = document.getElementById("screen-input");
  var screenOutput = document.getElementById("screen-output");
  var btnAgree = document.getElementById("btn-agree");
  var countdownEl = document.getElementById("countdown");
  var tickerInput = document.getElementById("ticker");
  var csvTextarea = document.getElementById("csv");
  var showAuditCheckbox = document.getElementById("show-audit");
  var btnCalculate = document.getElementById("btn-calculate");
  var outputError = document.getElementById("output-error");
  var outputPre = document.getElementById("output-pre");
  var btnCopy = document.getElementById("btn-copy");
  var btnStartOver = document.getElementById("btn-start-over");
  function showScreen(screen) {
    screenDisclaimer.classList.remove("active");
    screenInput.classList.remove("active");
    screenOutput.classList.remove("active");
    screen.classList.add("active");
  }
  var DELAY_MS = 3e3;
  var countdownRemaining;
  var countdownInterval = null;
  function startCountdown() {
    countdownRemaining = Math.ceil(DELAY_MS / 1e3);
    countdownEl.textContent = `(${countdownRemaining}s)`;
    countdownInterval = setInterval(() => {
      countdownRemaining--;
      if (countdownRemaining <= 0) {
        if (countdownInterval) clearInterval(countdownInterval);
        countdownInterval = null;
        btnAgree.disabled = false;
        countdownEl.textContent = "";
      } else {
        countdownEl.textContent = `(${countdownRemaining}s)`;
      }
    }, 1e3);
  }
  startCountdown();
  btnAgree.addEventListener("click", () => {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    showScreen(screenInput);
  });
  btnCalculate.addEventListener("click", () => {
    const ticker = tickerInput.value.trim();
    const csvText = csvTextarea.value.trim();
    showScreen(screenOutput);
    outputError.style.display = "none";
    outputPre.style.display = "none";
    if (!ticker) {
      showOutputError("Please enter a ticker symbol.");
      return;
    }
    if (!csvText) {
      showOutputError("Please paste CSV data.");
      return;
    }
    try {
      const rows = parseRows(csvText);
      const result = AdjustedCostBasisCalculator.forTicker(ticker).addRows(rows).calculate();
      const showAudit = showAuditCheckbox.checked;
      const formatted = formatResultTable(result, { audit: showAudit });
      outputPre.textContent = formatted;
      outputPre.style.display = "block";
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showOutputError(message);
    }
  });
  function showOutputError(message) {
    outputError.textContent = message;
    outputError.style.display = "block";
    outputPre.style.display = "none";
  }
  btnCopy.addEventListener("click", () => {
    const text = outputPre.textContent;
    if (text) {
      void navigator.clipboard.writeText(text);
    }
  });
  btnStartOver.addEventListener("click", () => {
    showScreen(screenInput);
  });
})();
/*! Bundled license information:

decimal.js/decimal.mjs:
  (*!
   *  decimal.js v10.6.0
   *  An arbitrary-precision Decimal type for JavaScript.
   *  https://github.com/MikeMcl/decimal.js
   *  Copyright (c) 2025 Michael Mclaughlin <M8ch88l@gmail.com>
   *  MIT Licence
   *)
*/
//# sourceMappingURL=bundle.js.map
