/**
 * Safe arithmetic for parameterised questions. Teachers write answer formulas
 * such as `V / (R1 + R2)` or `1000 * vc / (pi * d)`; this parses them into a
 * tree and evaluates against the drawn values. There is no `eval`, no property
 * access and no user-defined functions, so a formula can only ever compute a
 * number. Pure TypeScript, so the API, the app and the prototype share it.
 *
 *   expr   := term (('+' | '-') term)*
 *   term   := unary (('*' | '/' | '%') unary)*
 *   unary  := '-' unary | power              (-x^2 is -(x^2), as in maths)
 *   power  := primary ('^' unary)?           (right-associative)
 *   primary:= number | name | name '(' args ')' | '(' expr ')'
 */
export type Node =
  | { k: 'num'; v: number }
  | { k: 'var'; name: string }
  | { k: 'neg'; a: Node }
  | { k: 'bin'; op: '+' | '-' | '*' | '/' | '%' | '^'; a: Node; b: Node }
  | { k: 'call'; fn: string; args: Node[] };

const FUNCS: Record<string, (...x: number[]) => number> = {
  sqrt: Math.sqrt, abs: Math.abs, min: Math.min, max: Math.max, round: (x, d = 0) => Math.round(x * 10 ** d) / 10 ** d,
  floor: Math.floor, ceil: Math.ceil, sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos,
  atan: Math.atan, ln: Math.log, log10: Math.log10, exp: Math.exp,
  // Degrees helpers: workshop drawings give angles in degrees.
  sind: (x) => Math.sin((x * Math.PI) / 180), cosd: (x) => Math.cos((x * Math.PI) / 180), tand: (x) => Math.tan((x * Math.PI) / 180),
};
const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E, g: 9.80665 };

export class ExprError extends Error {}

export function parse(src: string): Node {
  if (src.length > 500) throw new ExprError('Formula is too long');
  const toks = src.match(/\d+(?:\.\d+)?(?:e[+-]?\d+)?|[A-Za-z_][A-Za-z0-9_]*|[-+*/%^(),]|\S/g) ?? [];
  let i = 0;
  const peek = () => toks[i];
  const take = (t?: string) => {
    const x = toks[i];
    if (t !== undefined && x !== t) throw new ExprError(`Expected "${t}" but found "${x ?? 'end'}"`);
    i++;
    return x!;
  };
  const expr = (): Node => {
    let n = term();
    while (peek() === '+' || peek() === '-') n = { k: 'bin', op: take() as '+' | '-', a: n, b: term() };
    return n;
  };
  const term = (): Node => {
    let n = unary();
    while (peek() === '*' || peek() === '/' || peek() === '%') n = { k: 'bin', op: take() as '*' | '/' | '%', a: n, b: unary() };
    return n;
  };
  const unary = (): Node => {
    if (peek() === '-') { take(); return { k: 'neg', a: unary() }; }
    if (peek() === '+') { take(); return unary(); }
    return power();
  };
  const power = (): Node => {
    const base = primary();
    if (peek() === '^') { take(); return { k: 'bin', op: '^', a: base, b: unary() }; }
    return base;
  };
  const primary = (): Node => {
    const t = peek();
    if (t === undefined) throw new ExprError('Unexpected end of formula');
    if (/^\d/.test(t)) { take(); return { k: 'num', v: Number(t) }; }
    if (t === '(') { take(); const n = expr(); take(')'); return n; }
    if (/^[A-Za-z_]/.test(t)) {
      take();
      if (peek() === '(') {
        if (!FUNCS[t]) throw new ExprError(`Unknown function "${t}"`);
        take('(');
        const args: Node[] = [];
        if (peek() !== ')') { args.push(expr()); while (peek() === ',') { take(); args.push(expr()); } }
        take(')');
        return { k: 'call', fn: t, args };
      }
      return { k: 'var', name: t };
    }
    throw new ExprError(`Unexpected "${t}"`);
  };
  const tree = expr();
  if (i < toks.length) throw new ExprError(`Unexpected "${toks[i]}"`);
  return tree;
}

export function evaluateNode(n: Node, vars: Record<string, number>): number {
  switch (n.k) {
    case 'num': return n.v;
    case 'var': {
      if (n.name in vars) return vars[n.name]!;
      if (n.name in CONSTS) return CONSTS[n.name]!;
      throw new ExprError(`Unknown variable "${n.name}"`);
    }
    case 'neg': return -evaluateNode(n.a, vars);
    case 'call': return FUNCS[n.fn]!(...n.args.map((a) => evaluateNode(a, vars)));
    case 'bin': {
      const a = evaluateNode(n.a, vars), b = evaluateNode(n.b, vars);
      switch (n.op) {
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/': return a / b;
        case '%': return a % b;
        case '^': return a ** b;
      }
    }
  }
}

/** Variable names a formula reads (constants excluded). */
export function variables(n: Node, out = new Set<string>()): Set<string> {
  if (n.k === 'var' && !(n.name in CONSTS)) out.add(n.name);
  else if (n.k === 'neg') variables(n.a, out);
  else if (n.k === 'bin') { variables(n.a, out); variables(n.b, out); }
  else if (n.k === 'call') n.args.forEach((a) => variables(a, out));
  return out;
}

export function evaluate(src: string, vars: Record<string, number>): number {
  const v = evaluateNode(parse(src), vars);
  if (!Number.isFinite(v)) throw new ExprError('Formula did not give a finite number');
  return v;
}
