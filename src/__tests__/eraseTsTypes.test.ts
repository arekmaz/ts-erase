import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { eraseTsTypes } from "../eraseTsTypes.ts";

function expectErasure(input: string, expected: string): void {
  const result = eraseTsTypes(input);
  assert.strictEqual(result.length, input.length);
  assert.strictEqual(result, expected);
}

describe("eraseTsTypes", () => {
  describe("length preservation", () => {
    it("always produces output with the same length as input", () => {
      const inputs = [
        `const x: string = "hello"`,
        `function foo<T>(x: T): T { return x }`,
        `interface Foo { bar: string; baz: number }`,
        `type ID = string | number`,
        `import type { Foo } from "./bar"`,
        `import { type Foo, Bar } from "./bar"`,
        `const y = x as string`,
        `const y = x satisfies Record<string, number>`,
        `x!.foo`,
        `declare const ENV: string`,
        `export type { Config }`,
      ];
      for (const input of inputs) {
        assert.strictEqual(eraseTsTypes(input).length, input.length);
      }
    });

    it("preserves newline positions in multiline input", () => {
      const input = `interface Foo {\n  bar: string\n  baz: number\n}`;
      const result = eraseTsTypes(input);
      for (let i = 0; i < input.length; i++) {
        if (input[i] === "\n") {
          assert.strictEqual(result[i], "\n");
        }
      }
    });
  });

  describe("type annotations", () => {
    it("erases variable type annotation with const", () => {
      expectErasure(`const x: string = "hello"`, `const x         = "hello"`);
    });

    it("erases variable type annotation with let", () => {
      expectErasure(`let x: number = 5`, `let x         = 5`);
    });

    it("erases variable type annotation with var", () => {
      expectErasure(`var x: boolean = true`, `var x          = true`);
    });

    it("erases function parameter annotations", () => {
      expectErasure(
        `function foo(x: number, y: string) {}`,
        `function foo(x        , y        ) {}`,
      );
    });

    it("erases function return type annotation", () => {
      expectErasure(
        `function foo(x: number): string { return "" }`,
        `function foo(x        )         { return "" }`,
      );
    });

    it("erases arrow function return type before =>", () => {
      expectErasure(
        `const f = (x: number): string => x.toString()`,
        `const f = (x        )         => x.toString()`,
      );
    });

    it("erases optional parameter annotation", () => {
      expectErasure(
        `function foo(x?: number) {}`,
        `function foo(x         ) {}`,
      );
    });

    it("erases array type annotation", () => {
      expectErasure(`const x: string[] = []`, `const x           = []`);
    });

    it("erases union type annotation", () => {
      expectErasure(
        `const x: string | number = 1`,
        `const x                  = 1`,
      );
    });

    it("erases complex generic type annotation", () => {
      expectErasure(
        `const x: Map<string, number> = new Map()`,
        `const x                      = new Map()`,
      );
    });

    it("erases tuple type annotation", () => {
      expectErasure(
        `const x: [string, number] = ["a", 1]`,
        `const x                   = ["a", 1]`,
      );
    });

    it("erases function type annotation", () => {
      expectErasure(
        `const f: (x: number) => string = String`,
        `const f                        = String`,
      );
    });

    it("erases multiple parameter annotations", () => {
      expectErasure(
        `function f(a: string, b: number, c: boolean) {}`,
        `function f(a        , b        , c         ) {}`,
      );
    });

    it("erases parameter with default value", () => {
      expectErasure(
        `function f(x: number = 5) {}`,
        `function f(x         = 5) {}`,
      );
    });

    it("erases destructured parameter annotation", () => {
      expectErasure(
        `function f({ a, b }: Props) {}`,
        `function f({ a, b }       ) {}`,
      );
    });

    it("erases rest parameter annotation", () => {
      expectErasure(
        `function f(...args: Array<string>) {}`,
        `function f(...args               ) {}`,
      );
    });
  });

  describe("interface declarations", () => {
    it("erases simple interface", () => {
      expectErasure(
        `interface Foo { bar: string }`,
        `;                            `,
      );
    });

    it("erases interface followed by code", () => {
      expectErasure(
        `interface Foo { bar: string }\nconst x = 1`,
        `;                            \nconst x = 1`,
      );
    });

    it("erases multiline interface preserving newlines", () => {
      const input = "interface Foo {\n  bar: string\n}";
      const result = eraseTsTypes(input);
      assert.strictEqual(result[0], ";");
      assert.strictEqual(result.length, input.length);
      const newlines = [];
      for (let i = 0; i < input.length; i++) {
        if (input[i] === "\n") {
          newlines.push(i);
        }
      }
      for (const idx of newlines) {
        assert.strictEqual(result[idx], "\n");
      }
    });

    it("erases interface with extends", () => {
      expectErasure(
        `interface Foo extends Bar { baz: number }`,
        `;                                        `,
      );
    });

    it("does not erase interface used as property name after dot", () => {
      const input = `obj.interface = 1`;
      expectErasure(input, input);
    });

    it("erases interface with semicolon", () => {
      expectErasure(
        `interface Foo { bar: string };`,
        `;                            ;`,
      );
    });
  });

  describe("type alias declarations", () => {
    it("erases simple type alias", () => {
      expectErasure(`type Foo = string`, `;                `);
    });

    it("erases union type alias", () => {
      expectErasure(`type ID = string | number`, `;                        `);
    });

    it("erases type alias followed by code", () => {
      expectErasure(
        `type ID = string | number\nconst x = 1`,
        `;                        \nconst x = 1`,
      );
    });

    it("erases generic type alias", () => {
      expectErasure(`type Result<T> = { ok: T }`, `;                         `);
    });

    it("does not erase 'type' used as a variable name", () => {
      const input = `const type = "hello"`;
      expectErasure(input, input);
    });

    it("does not erase 'type' as property after dot", () => {
      const input = `obj.type = "hello"`;
      expectErasure(input, input);
    });

    it("erases type alias with semicolon terminator", () => {
      expectErasure(`type Foo = string;`, `;                 `);
    });
  });

  describe("import type", () => {
    it("erases full import type statement", () => {
      expectErasure(
        `import type { Foo } from "./bar"`,
        `;                               `,
      );
    });

    it("erases import type with semicolon", () => {
      expectErasure(
        `import type { Foo } from "./bar";`,
        `;                                `,
      );
    });

    it("erases import type followed by code on next line", () => {
      expectErasure(
        `import type { Foo } from "./bar"\nconst x = 1`,
        `;                               \nconst x = 1`,
      );
    });

    it("erases import type default", () => {
      expectErasure(
        `import type Foo from "./bar"`,
        `;                           `,
      );
    });

    it("erases import type with multiple specifiers", () => {
      const input = `import type { Foo, Bar, Baz } from "./mod"`;
      const result = eraseTsTypes(input);
      assert.strictEqual(result.length, input.length);
      assert.strictEqual(result[0], ";");
      assert.strictEqual(result.trim(), ";");
    });
  });

  describe("inline type in imports", () => {
    it("erases type specifier at the beginning", () => {
      expectErasure(
        `import { type Foo, Bar } from "./bar"`,
        `import {           Bar } from "./bar"`,
      );
    });

    it("erases type specifier at the end", () => {
      expectErasure(
        `import { Bar, type Foo } from "./bar"`,
        `import { Bar           } from "./bar"`,
      );
    });

    it("erases type specifier in the middle", () => {
      expectErasure(
        `import { A, type B, C } from "./bar"`,
        `import { A,         C } from "./bar"`,
      );
    });

    it("erases multiple inline type specifiers", () => {
      expectErasure(
        `import { type A, real, type B } from "./bar"`,
        `import {         real         } from "./bar"`,
      );
    });

    it("preserves non-type imports untouched", () => {
      const input = `import { Foo, Bar } from "./bar"`;
      expectErasure(input, input);
    });
  });

  describe("export type", () => {
    it("erases export type with braces", () => {
      expectErasure(
        `export type { Foo } from "./bar"`,
        `;                               `,
      );
    });

    it("erases export type with semicolon", () => {
      expectErasure(
        `export type { Foo } from "./bar";`,
        `;                                `,
      );
    });

    it("erases export type with multiple specifiers", () => {
      expectErasure(`export type { Foo, Bar }`, `;                       `);
    });

    it("does not erase regular export", () => {
      const input = `export { Foo } from "./bar"`;
      expectErasure(input, input);
    });

    it("erases export type alias", () => {
      expectErasure(`export type Foo = string`, `;                       `);
    });
  });

  describe("generics", () => {
    it("erases generic on function call", () => {
      expectErasure(`foo<string>(x)`, `foo        (x)`);
    });

    it("erases generic on function definition", () => {
      expectErasure(
        `function foo<T>(x: T): T { return x }`,
        `function foo   (x   )    { return x }`,
      );
    });

    it("erases nested generics", () => {
      expectErasure(
        `foo<Map<string, Array<number>>>(x)`,
        `foo                            (x)`,
      );
    });

    it("erases generic with multiple type parameters", () => {
      expectErasure(`foo<A, B, C>(x)`, `foo         (x)`);
    });

    it("does not erase less-than comparison", () => {
      const input = `if (a < b) {}`;
      expectErasure(input, input);
    });

    it("does not erase less-than in numeric expression", () => {
      const input = `const x = 1 < 2`;
      expectErasure(input, input);
    });

    it("erases generic with extends constraint", () => {
      expectErasure(
        `function foo<T extends string>(x: T) {}`,
        `function foo                  (x   ) {}`,
      );
    });

    it("preserves arrow function generic (not preceded by identifier)", () => {
      expectErasure(
        `const f = <T,>(x: T): T => x`,
        `const f =     (x   )    => x`,
      );
    });
  });

  describe("as expressions", () => {
    it("erases simple as expression", () => {
      expectErasure(`const x = y as string`, `const x = y          `);
    });

    it("erases as expression with generic type", () => {
      expectErasure(
        `const x = y as Map<string, number>`,
        `const x = y                       `,
      );
    });

    it("erases as const", () => {
      expectErasure(`const x = [1, 2] as const`, `const x = [1, 2]         `);
    });

    it("erases as expression in function argument", () => {
      expectErasure(`foo(x as string, y)`, `foo(x          , y)`);
    });

    it("erases as expression after parenthesized expression", () => {
      expectErasure(
        `const x = (a + b) as number`,
        `const x = (a + b)          `,
      );
    });

    it("erases as expression after array access", () => {
      expectErasure(`const x = arr[0] as string`, `const x = arr[0]          `);
    });

    it("does not erase 'as' after dot", () => {
      const input = `obj.as = 1`;
      expectErasure(input, input);
    });

    it("does not erase 'as' at statement start", () => {
      const input = `as = 1`;
      expectErasure(input, input);
    });

    it("does not erase 'as' rename in import specifiers", () => {
      const input = `import { foo as bar } from "./mod"`;
      expectErasure(input, input);
    });

    it("does not erase 'as' rename in export specifiers", () => {
      const input = `export { default as html } from "./mod"`;
      expectErasure(input, input);
    });

    it("does not erase 'as' rename with multiple export specifiers", () => {
      const input = `export { foo as bar, baz as qux } from "./mod"`;
      expectErasure(input, input);
    });
  });

  describe("satisfies expressions", () => {
    it("erases simple satisfies expression", () => {
      expectErasure(
        "const x = y satisfies number",
        "const x = y                 ",
      );
    });

    it("erases satisfies with generic type", () => {
      expectErasure(
        "const x = y satisfies Record<string, number>",
        "const x = y                                 ",
      );
    });

    it("erases satisfies in function argument", () => {
      expectErasure(`foo(x satisfies string, y)`, `foo(x                 , y)`);
    });

    it("does not erase 'satisfies' after dot", () => {
      const input = `obj.satisfies = 1`;
      expectErasure(input, input);
    });
  });

  describe("non-null assertions", () => {
    it("erases non-null assertion before dot", () => {
      expectErasure(`x!.foo`, `x .foo`);
    });

    it("erases non-null assertion before bracket", () => {
      expectErasure(`x![0]`, `x [0]`);
    });

    it("does not erase logical not", () => {
      const input = `if (!x) {}`;
      expectErasure(input, input);
    });

    it("does not erase inequality operator", () => {
      const input = `if (x !== y) {}`;
      expectErasure(input, input);
    });

    it("erases non-null assertion on function result", () => {
      expectErasure(`foo()!.bar`, `foo() .bar`);
    });

    it("erases non-null assertion before function call", () => {
      expectErasure(`obj.fn!(x)`, `obj.fn (x)`);
    });

    it("erases non-null assertion on array access", () => {
      expectErasure(`arr[0]!.x`, `arr[0] .x`);
    });

    it("erases non-null assertion before closing paren", () => {
      expectErasure(`foo(x!)`, `foo(x )`);
    });
  });

  describe("declare blocks", () => {
    it("erases declare const", () => {
      expectErasure(`declare const x: string`, `;                      `);
    });

    it("erases declare function", () => {
      expectErasure(
        `declare function foo(): void`,
        `;                           `,
      );
    });

    it("erases declare followed by code on next line", () => {
      expectErasure(
        `declare const x: string\nconst y = 1`,
        `;                      \nconst y = 1`,
      );
    });

    it("does not erase 'declare' after dot", () => {
      const input = `obj.declare = 1`;
      expectErasure(input, input);
    });
  });

  describe("opaque region protection", () => {
    it("does not erase inside single-quoted string", () => {
      const input = `const s = 'const x: string'`;
      expectErasure(input, input);
    });

    it("does not erase inside double-quoted string", () => {
      const input = `const s = "const x: string"`;
      expectErasure(input, input);
    });

    it("does not erase inside template literal", () => {
      const input = "const s = `x: ${y}`";
      expectErasure(input, input);
    });

    it("does not erase inside line comment", () => {
      const input = `// const x: string\nconst y = 1`;
      expectErasure(input, input);
    });

    it("does not erase inside block comment", () => {
      const input = `/* interface Foo {} */\nconst y = 1`;
      expectErasure(input, input);
    });

    it("handles string with escaped quotes", () => {
      const input = `const s = "it\\'s a \\"type\\": string"`;
      expectErasure(input, input);
    });

    it("handles nested template literal expressions", () => {
      const input = "const s = `${`inner: ${x}`}`";
      expectErasure(input, input);
    });

    it("handles string containing interface keyword", () => {
      const input = `const s = "interface Foo { bar: string }"`;
      expectErasure(input, input);
    });

    it("handles string containing import type", () => {
      const input = `const s = "import type { Foo } from 'bar'"`;
      expectErasure(input, input);
    });

    it("erases type annotations inside template literal interpolations", () => {
      expectErasure(
        "html`click ${(e: Event) => handle(e)}`",
        "html`click ${(e       ) => handle(e)}`",
      );
    });

    it("erases as expression inside template literal interpolation", () => {
      expectErasure(
        "html`${(e.target as HTMLInputElement).value}`",
        "html`${(e.target                    ).value}`",
      );
    });

    it("erases types in nested template literal interpolations", () => {
      expectErasure(
        "html`${(x: number) => html`${(y: string) => y}`}`",
        "html`${(x        ) => html`${(y        ) => y}`}`",
      );
    });

    it("does not erase static text in template literals", () => {
      const input = 'html`<div class="foo">text</div>`';
      expectErasure(input, input);
    });
  });

  describe("ASI protection", () => {
    it("inserts semicolon prefix for erased interface", () => {
      const input = `interface Foo {}`;
      const result = eraseTsTypes(input);
      assert.strictEqual(result[0], ";");
    });

    it("inserts semicolon prefix for erased type alias", () => {
      const input = `type Foo = string`;
      const result = eraseTsTypes(input);
      assert.strictEqual(result[0], ";");
    });

    it("inserts semicolon prefix for erased import type", () => {
      const input = `import type { Foo } from "./bar"`;
      const result = eraseTsTypes(input);
      assert.strictEqual(result[0], ";");
    });

    it("inserts semicolon prefix for erased export type", () => {
      const input = `export type { Foo }`;
      const result = eraseTsTypes(input);
      assert.strictEqual(result[0], ";");
    });

    it("inserts semicolon prefix for erased declare", () => {
      const input = `declare const x: string`;
      const result = eraseTsTypes(input);
      assert.strictEqual(result[0], ";");
    });

    it("does not insert semicolon for non-statement erasures", () => {
      const result = eraseTsTypes(`const x: string = "hi"`);
      assert.ok(!result.includes(";"));
    });
  });

  describe("combinations and complex cases", () => {
    it("handles function with generics, typed params, and return type", () => {
      expectErasure(
        `function foo<T>(x: T, y: string): T { return x }`,
        `function foo   (x   , y        )    { return x }`,
      );
    });

    it("handles multiple statements on separate lines", () => {
      expectErasure(
        `type A = string\ntype B = number\nconst x = 1`,
        `;              \n;              \nconst x = 1`,
      );
    });

    it("handles mixed import with type and value specifiers", () => {
      expectErasure(
        `import { type A, b, type C, d } from "./mod"`,
        `import {         b,         d } from "./mod"`,
      );
    });

    it("handles as expression followed by property access", () => {
      expectErasure(`(x as Foo).bar`, `(x       ).bar`);
    });

    it("handles chained non-null assertions", () => {
      expectErasure(`a!.b!.c`, `a .b .c`);
    });

    it("handles generic call inside another expression", () => {
      expectErasure(
        `const x = foo<string>(bar<number>(y))`,
        `const x = foo        (bar        (y))`,
      );
    });

    it("leaves plain javascript completely untouched", () => {
      const input = `const x = 1\nfunction foo(a, b) { return a + b }\nconst arr = [1, 2, 3]`;
      expectErasure(input, input);
    });

    it("handles empty input", () => {
      expectErasure("", "");
    });

    it("handles input with no type syntax", () => {
      const input = `console.log("hello world")`;
      expectErasure(input, input);
    });

    it("handles object literal colons (not type annotations)", () => {
      const input = `const obj = { a: 1, b: "two" }`;
      expectErasure(input, input);
    });

    it("handles ternary operator colon", () => {
      const input = `const x = true ? 1 : 2`;
      expectErasure(input, input);
    });

    it("handles switch case colon", () => {
      const input = `switch (x) { case 1: break; default: break }`;
      expectErasure(input, input);
    });

    it("handles labeled statement colon", () => {
      const input = `outer: for (;;) { break outer }`;
      expectErasure(input, input);
    });

    it("preserves import of values", () => {
      const input = `import { foo, bar } from "./mod"`;
      expectErasure(input, input);
    });

    it("preserves regular export", () => {
      const input = `export { foo, bar }`;
      expectErasure(input, input);
    });

    it("preserves export default", () => {
      const input = `export default function foo() {}`;
      expectErasure(input, input);
    });

    it("handles class method with types", () => {
      expectErasure(
        `class Foo { bar(x: string): number { return 1 } }`,
        `class Foo { bar(x        )         { return 1 } }`,
      );
    });

    it("handles real-world multiline function", () => {
      const input = [
        `function processItems<T>(`,
        `  items: Array<T>,`,
        `  callback: (item: T) => void`,
        `): void {`,
        `  items.forEach(callback)`,
        `}`,
      ].join("\n");
      const result = eraseTsTypes(input);
      assert.strictEqual(result.length, input.length);
      assert.ok(result.includes("items.forEach(callback)"));
      assert.ok(!result.includes("Array<T>"));
      assert.ok(!result.includes(": void"));
    });

    it("handles interface followed by expression without ASI issue", () => {
      const input = `interface Foo {}\n;[1, 2].forEach(x => x)`;
      const result = eraseTsTypes(input);
      assert.strictEqual(result.length, input.length);
      assert.ok(result.includes(";[1, 2].forEach(x => x)"));
    });
  });

  describe("ternary operator", () => {
    it("preserves ternary colon after function call inside outer call", () => {
      const input = `createEffect(function f() { const v = typeof x === "function" ? x() : x })`;
      expectErasure(input, input);
    });

    it("preserves ternary colon after method call in nested context", () => {
      const input = `const value = typeof props.children === "function" ? props.children() : props.children`;
      expectErasure(input, input);
    });

    it("erases as in ternary without eating the else branch", () => {
      expectErasure(
        `const x = stored ? JSON.parse(stored) as T : fallback`,
        `const x = stored ? JSON.parse(stored)      : fallback`,
      );
    });
  });

  describe("edge cases", () => {
    it("handles type annotation with parenthesized type", () => {
      expectErasure(
        `const x: (string | number) = 1`,
        `const x                    = 1`,
      );
    });

    it("handles as expression with union type", () => {
      expectErasure(
        `const x = y as string | number`,
        `const x = y                   `,
      );
    });

    it("handles multiple type aliases in sequence", () => {
      expectErasure(
        `type A = string\ntype B = number`,
        `;              \n;              `,
      );
    });

    it("handles type with typeof", () => {
      expectErasure(`const x: typeof y = y`, `const x           = y`);
    });

    it("handles import with 'as' renaming (not type-as)", () => {
      const input = `import { foo as bar } from "./mod"`;
      expectErasure(input, input);
    });

    it("handles generic with string literal type in angle brackets", () => {
      expectErasure(`foo<"a" | "b">(x)`, `foo           (x)`);
    });

    it("handles consecutive interfaces", () => {
      expectErasure(
        `interface A {}\ninterface B {}`,
        `;             \n;             `,
      );
    });

    it("handles type alias referencing another type", () => {
      expectErasure(`type Pair<A, B> = [A, B]`, `;                       `);
    });

    it("handles import type with star", () => {
      expectErasure(
        `import type * as Ns from "./mod"`,
        `;                               `,
      );
    });

    it("handles only whitespace input", () => {
      expectErasure("   \n  \n  ", "   \n  \n  ");
    });

    it("handles declare with semicolon", () => {
      expectErasure(`declare const x: string;`, `;                       `);
    });

    it("handles satisfies with array type", () => {
      expectErasure(
        `const x = [] satisfies string[]`,
        `const x = []                   `,
      );
    });

    it("handles as expression at end of line", () => {
      expectErasure(
        `const x = y as string\nconst z = 1`,
        `const x = y          \nconst z = 1`,
      );
    });

    it("handles generic with default type parameter", () => {
      expectErasure(
        `function foo<T = string>(x: T) {}`,
        `function foo            (x   ) {}`,
      );
    });

    it("handles export type alias with generics", () => {
      expectErasure(
        `export type Result<T> = { ok: T }`,
        `;                                `,
      );
    });

    it("handles deeply nested generic types", () => {
      expectErasure(
        `foo<Map<string, Set<Array<number>>>>(x)`,
        `foo                                 (x)`,
      );
    });

    it("handles class with typed constructor parameter", () => {
      expectErasure(
        `class Foo { constructor(name: string) {} }`,
        `class Foo { constructor(name        ) {} }`,
      );
    });

    it("handles parameter type containing arrow function type with return type", () => {
      expectErasure(
        `function resolve(value: CssValue | (() => CssValue)): string {`,
        `function resolve(value                             )         {`,
      );
    });
  });

  describe("object literals inside function calls", () => {
    it("preserves object literal properties inside function call", () => {
      const input = `foo({ id: 1, name: "bar" })`;
      expectErasure(input, input);
    });

    it("preserves object literal with expressions as values", () => {
      const input = `foo({ id: nextId++, text, done: false })`;
      expectErasure(input, input);
    });

    it("preserves object literal spread and properties in call", () => {
      const input = `foo({ ...t, done: !t.done })`;
      expectErasure(input, input);
    });

    it("preserves nested object literals in function calls", () => {
      const input = `foo({ a: { b: 1, c: 2 } })`;
      expectErasure(input, input);
    });

    it("preserves object literal in array in function call", () => {
      const input = `foo([{ id: 1 }, { id: 2 }])`;
      expectErasure(input, input);
    });

    it("still erases type annotations on function parameters", () => {
      expectErasure(
        `function foo(x: number, y: string) {}`,
        `function foo(x        , y        ) {}`,
      );
    });

    it("still erases type annotation on destructured parameter", () => {
      expectErasure(
        `function foo({ a, b }: Props) {}`,
        `function foo({ a, b }       ) {}`,
      );
    });

    it("preserves object literal in method call chain", () => {
      const input = `arr.map((t) => t.id === id ? { ...t, done: !t.done } : t)`;
      expectErasure(input, input);
    });

    it("preserves object in nested call", () => {
      const input = `setTodos([...todos(), { id: nextId++, text, done: false }])`;
      expectErasure(input, input);
    });

    it("preserves ternary colon after object literal inside parens", () => {
      const input = `foo(cond ? { a: 1 } : fallback)`;
      expectErasure(input, input);
    });

    it("erases destructured parameter type annotation inside parens", () => {
      expectErasure(
        `foo(({ a, b }: Props) => a + b)`,
        `foo(({ a, b }       ) => a + b)`,
      );
    });
  });

  describe("enum declarations", () => {
    it("preserves const enum (runtime construct)", () => {
      const input = `const enum Direction { Up, Down }`;
      expectErasure(input, input);
    });

    it("preserves regular enum", () => {
      const input = `enum Color { Red, Green, Blue }`;
      expectErasure(input, input);
    });
  });

  describe("class features", () => {
    it("erases class generic parameter", () => {
      expectErasure(`class Box<T> { value: T }`, `class Box    { value    }`);
    });

    it("erases class implements clause", () => {
      expectErasure(
        `class Foo implements Bar { }`,
        `class Foo                { }`,
      );
    });

    it("erases class extends with generic", () => {
      expectErasure(
        `class Foo extends Base<string> { }`,
        `class Foo extends Base         { }`,
      );
    });

    it("erases class method return type", () => {
      expectErasure(
        `class C { get x(): number { return 1 } }`,
        `class C { get x()         { return 1 } }`,
      );
    });

    it("erases class method parameter types", () => {
      expectErasure(
        `class C { set x(v: number) {} }`,
        `class C { set x(v        ) {} }`,
      );
    });

    it("erases all constructor parameter types", () => {
      expectErasure(
        `class C { constructor(name: string, age: number) {} }`,
        `class C { constructor(name        , age        ) {} }`,
      );
    });

    it("erases multiple generic constraints on class", () => {
      expectErasure(
        `class C<T extends string, U extends number> {}`,
        `class C                                     {}`,
      );
    });

    it("erases method with generics and typed params", () => {
      expectErasure(
        `class C { foo<T>(x: T): T { return x } }`,
        `class C { foo   (x   )    { return x } }`,
      );
    });
  });

  describe("arrow functions", () => {
    it("erases arrow function parameter type", () => {
      expectErasure(`const f = (x: number) => x`, `const f = (x        ) => x`);
    });

    it("erases arrow function with multiple typed params", () => {
      expectErasure(
        `const f = (a: string, b: number) => a`,
        `const f = (a        , b        ) => a`,
      );
    });

    it("erases generic arrow function with trailing comma", () => {
      expectErasure(`const f = <T,>(x: T) => x`, `const f =     (x   ) => x`);
    });

    it("erases arrow with destructured param type", () => {
      expectErasure(
        `const f = ({ a, b }: Props) => a + b`,
        `const f = ({ a, b }       ) => a + b`,
      );
    });

    it("erases arrow function return type annotation", () => {
      expectErasure(
        `const f = (x: number): string => String(x)`,
        `const f = (x        )         => String(x)`,
      );
    });
  });

  describe("intersection types", () => {
    it("erases intersection type annotation", () => {
      expectErasure(`const x: A & B = val`, `const x        = val`);
    });

    it("erases complex intersection in parameter", () => {
      expectErasure(
        `function f(x: A & B & C) {}`,
        `function f(x           ) {}`,
      );
    });
  });

  describe("conditional types in annotations", () => {
    it("erases conditional type in type alias", () => {
      const input = `type IsString<T> = T extends string ? true : false`;
      const result = eraseTsTypes(input);
      assert.strictEqual(result.length, input.length);
      assert.strictEqual(result[0], ";");
      assert.strictEqual(result.trim(), ";");
    });

    it("erases mapped type alias", () => {
      const input = `type Readonly<T> = { readonly [K in keyof T]: T[K] }`;
      const result = eraseTsTypes(input);
      assert.strictEqual(result.length, input.length);
      assert.strictEqual(result[0], ";");
      assert.strictEqual(result.trim(), ";");
    });

    it("erases infer in conditional type alias", () => {
      const input = `type Unpack<T> = T extends Array<infer U> ? U : T`;
      const result = eraseTsTypes(input);
      assert.strictEqual(result.length, input.length);
      assert.strictEqual(result[0], ";");
      assert.strictEqual(result.trim(), ";");
    });
  });

  describe("keyof and typeof in type positions", () => {
    it("erases keyof type annotation", () => {
      expectErasure(`const x: keyof Foo = "bar"`, `const x            = "bar"`);
    });

    it("erases typeof in type annotation", () => {
      expectErasure(`const x: typeof y = y`, `const x           = y`);
    });

    it("erases keyof typeof combination", () => {
      expectErasure(
        `const k: keyof typeof obj = "a"`,
        `const k                   = "a"`,
      );
    });
  });

  describe("literal types", () => {
    it("erases string literal type annotation", () => {
      expectErasure(`const x: "hello" = "hello"`, `const x          = "hello"`);
    });

    it("erases numeric literal type annotation", () => {
      expectErasure(`const x: 42 = 42`, `const x     = 42`);
    });

    it("erases boolean literal type annotation", () => {
      expectErasure(`const x: true = true`, `const x       = true`);
    });

    it("erases template literal type alias", () => {
      const input = "type Greeting = `hello ${string}`";
      const result = eraseTsTypes(input);
      assert.strictEqual(result.length, input.length);
      assert.strictEqual(result[0], ";");
    });
  });

  describe("readonly and misc type modifiers", () => {
    it("erases readonly array type annotation", () => {
      expectErasure(
        `const x: readonly string[] = []`,
        `const x                    = []`,
      );
    });

    it("erases ReadonlyArray generic type annotation", () => {
      expectErasure(
        `const x: ReadonlyArray<number> = []`,
        `const x                        = []`,
      );
    });
  });

  describe("index signatures and complex type aliases", () => {
    it("erases type alias with index signature", () => {
      const input = `type Dict = { [key: string]: number }`;
      const result = eraseTsTypes(input);
      assert.strictEqual(result.length, input.length);
      assert.strictEqual(result[0], ";");
      assert.strictEqual(result.trim(), ";");
    });

    it("erases type alias with template literal keys", () => {
      const input = "type Events = { [K in `on${string}`]: Function }";
      const result = eraseTsTypes(input);
      assert.strictEqual(result.length, input.length);
      assert.strictEqual(result[0], ";");
    });
  });

  describe("function overloads", () => {
    it("erases declare function overloads", () => {
      expectErasure(
        `declare function foo(x: string): string\ndeclare function foo(x: number): number`,
        `;                                      \n;                                      `,
      );
    });
  });

  describe("type assertions", () => {
    it("erases double as assertion", () => {
      expectErasure(
        `const x = y as unknown as string`,
        `const x = y                     `,
      );
    });

    it("erases as expression with array type", () => {
      expectErasure(`const x = y as string[]`, `const x = y            `);
    });

    it("erases as expression with tuple type", () => {
      expectErasure(
        `const x = y as [string, number]`,
        `const x = y                    `,
      );
    });

    it("erases as expression with object type", () => {
      expectErasure(
        `const x = y as { a: number }`,
        `const x = y                 `,
      );
    });

    it("erases satisfies with union type", () => {
      expectErasure(
        `const x = y satisfies string | number`,
        `const x = y                          `,
      );
    });
  });

  describe("non-null assertion edge cases", () => {
    it("erases chained non-null before method call", () => {
      expectErasure(`obj!.method()`, `obj .method()`);
    });

    it("erases non-null on parenthesized expression", () => {
      expectErasure(`(foo())!.bar`, `(foo()) .bar`);
    });

    it("does not erase != operator", () => {
      const input = `if (a != b) {}`;
      expectErasure(input, input);
    });

    it("does not erase negation in assignment", () => {
      const input = `const x = !flag`;
      expectErasure(input, input);
    });

    it("does not erase double negation", () => {
      const input = `const x = !!val`;
      expectErasure(input, input);
    });
  });

  describe("declare variations", () => {
    it("erases declare let", () => {
      expectErasure(`declare let x: number`, `;                    `);
    });

    it("erases declare var", () => {
      expectErasure(`declare var x: any`, `;                 `);
    });

    it("erases declare class", () => {
      expectErasure(
        `declare class Foo { bar(): void }`,
        `;                                `,
      );
    });

    it("erases declare module", () => {
      expectErasure(
        `declare module "foo" { export const x: string }`,
        `;                                              `,
      );
    });

    it("erases declare namespace", () => {
      expectErasure(
        `declare namespace Foo { const x: string }`,
        `;                                        `,
      );
    });

    it("erases declare global", () => {
      expectErasure(
        `declare global { var x: string }`,
        `;                               `,
      );
    });

    it("erases export declare", () => {
      const input = `export declare const x: string`;
      const result = eraseTsTypes(input);
      assert.strictEqual(result.length, input.length);
    });
  });

  describe("export inline type specifiers", () => {
    it("erases inline type in export braces", () => {
      const input = `export { type Foo, bar }`;
      const result = eraseTsTypes(input);
      assert.strictEqual(result.length, input.length);
    });

    it("erases export interface", () => {
      expectErasure(
        `export interface Foo { x: number }`,
        `;                                 `,
      );
    });

    it("erases multiline export interface", () => {
      const input = `export interface DOMAPI {\n  createElement(tag: string): Element\n}`;
      const result = eraseTsTypes(input);
      assert.strictEqual(result.length, input.length);
      assert.ok(!result.includes("DOMAPI"));
      assert.ok(!result.includes("createElement"));
    });

    it("erases export declare", () => {
      expectErasure(
        `export declare const x: number`,
        `;                             `,
      );
    });
  });

  describe("import type with generic", () => {
    it("erases import type with generic module specifier", () => {
      const input = `import type { Map } from "immutable"`;
      const result = eraseTsTypes(input);
      assert.strictEqual(result.length, input.length);
      assert.strictEqual(result[0], ";");
      assert.strictEqual(result.trim(), ";");
    });

    it("erases an inline type specifier with an alias", () => {
      expectErasure(
        `import { type Foo as Bar, baz } from "./mod"`,
        `import {                  baz } from "./mod"`,
      );
    });
  });

  describe("multiple statements and mixed code", () => {
    it("handles type alias between regular code", () => {
      expectErasure(
        `const a = 1\ntype B = string\nconst c = 2`,
        `const a = 1\n;              \nconst c = 2`,
      );
    });

    it("handles interface between regular code", () => {
      expectErasure(
        `const a = 1\ninterface B {}\nconst c = 2`,
        `const a = 1\n;             \nconst c = 2`,
      );
    });

    it("handles declare between regular code", () => {
      expectErasure(
        `const a = 1\ndeclare const b: string\nconst c = 2`,
        `const a = 1\n;                      \nconst c = 2`,
      );
    });

    it("handles multiple type constructs in sequence", () => {
      expectErasure(
        `type A = string\ninterface B {}\nimport type { C } from "./c"\nconst x = 1`,
        `;              \n;             \n;                           \nconst x = 1`,
      );
    });
  });

  describe("generic call expressions", () => {
    it("erases generic on new expression", () => {
      expectErasure(
        `const m = new Map<string, number>()`,
        `const m = new Map                ()`,
      );
    });

    it("erases generic on method call", () => {
      expectErasure(
        `arr.filter<string>(x => true)`,
        `arr.filter        (x => true)`,
      );
    });

    it("erases generic on chained method call", () => {
      expectErasure(`foo.bar<A>().baz<B>()`, `foo.bar   ().baz   ()`);
    });

    it("erases comparison that looks like generic after identifier", () => {
      const input = `if (a < b && c > d) {}`;
      expectErasure(input, input);
    });

    it("preserves shift operators", () => {
      const input = `const x = a >> 2`;
      expectErasure(input, input);
    });

    it("preserves unsigned shift operator", () => {
      const input = `const x = a >>> 2`;
      expectErasure(input, input);
    });
  });

  describe("complex real-world patterns", () => {
    it("handles async function with typed params and return", () => {
      expectErasure(
        `async function fetchData<T>(url: string): Promise<T> { return null as T }`,
        `async function fetchData   (url        )             { return null      }`,
      );
    });

    it("handles generator function with types", () => {
      expectErasure(
        `function* gen<T>(items: Array<T>): Generator<T> { yield items[0] }`,
        `function* gen   (items          )               { yield items[0] }`,
      );
    });

    it("handles for-of with typed variable", () => {
      const input = `for (const x of items) {}`;
      expectErasure(input, input);
    });

    it("handles try-catch with typed error", () => {
      expectErasure(
        `try {} catch (e: unknown) {}`,
        `try {} catch (e         ) {}`,
      );
    });

    it("handles object literal with method shorthand (no type erasure)", () => {
      const input = `const obj = { foo() { return 1 }, bar: 2 }`;
      expectErasure(input, input);
    });

    it("preserves computed property values", () => {
      const input = `const obj = { [key]: value, ["literal"]: 1 }`;
      expectErasure(input, input);
    });

    it("handles tagged template literal", () => {
      const input = "const x = tag`hello ${world}`";
      expectErasure(input, input);
    });

    it("handles regex that looks like generics", () => {
      const input = `const re = /foo<bar>/g`;
      expectErasure(input, input);
    });

    it("handles class expression with types", () => {
      expectErasure(
        `const C = class<T> { constructor(x: T) {} }`,
        `const C = class    { constructor(x   ) {} }`,
      );
    });

    it("handles nested function with types", () => {
      expectErasure(
        `function outer(a: string) { function inner(b: number): boolean { return true } }`,
        `function outer(a        ) { function inner(b        )          { return true } }`,
      );
    });

    it("handles comma-separated const declarations with types", () => {
      expectErasure(
        `const a: string = "x", b: number = 1`,
        `const a         = "x", b         = 1`,
      );
    });

    it("handles comma-separated let declarations with types inside function", () => {
      expectErasure(
        `function f() { let i: any, elm: Node, parent: Node; }`,
        `function f() { let i     , elm      , parent      ; }`,
      );
    });

    it("handles optional chaining (not confused with type annotation)", () => {
      const input = `const x = obj?.foo?.bar`;
      expectErasure(input, input);
    });

    it("handles nullish coalescing", () => {
      const input = `const x = a ?? b`;
      expectErasure(input, input);
    });

    it("handles logical assignment operators", () => {
      const input = `x ??= 5`;
      expectErasure(input, input);
    });

    it("erases as const on object literal", () => {
      expectErasure(
        `const x = { a: 1, b: 2 } as const`,
        `const x = { a: 1, b: 2 }         `,
      );
    });

    it("handles as const on array literal", () => {
      expectErasure(
        `const x = [1, 2, 3] as const`,
        `const x = [1, 2, 3]         `,
      );
    });

    it("erases satisfies on object literal partially", () => {
      const input = `const x = { a: 1 } satisfies Record<string, number>`;
      const result = eraseTsTypes(input);
      assert.strictEqual(result.length, input.length);
    });

    it("handles multiline arrow with types", () => {
      const input = [
        `const f = (`,
        `  a: string,`,
        `  b: number`,
        `): boolean => {`,
        `  return true`,
        `}`,
      ].join("\n");
      const result = eraseTsTypes(input);
      assert.strictEqual(result.length, input.length);
      assert.ok(result.includes("return true"));
      assert.ok(!result.includes(": string"));
      assert.ok(!result.includes(": number"));
      assert.ok(!result.includes(": boolean"));
    });

    it("handles callback parameter with function type", () => {
      expectErasure(
        `function f(cb: (x: number) => void) {}`,
        `function f(cb                     ) {}`,
      );
    });

    it("handles nested generic types in variable annotation", () => {
      expectErasure(
        `const x: Promise<Array<Map<string, Set<number>>>> = p`,
        `const x                                           = p`,
      );
    });

    it("handles type annotation after array destructuring", () => {
      expectErasure(
        `function f([a, b]: [string, number]) {}`,
        `function f([a, b]                  ) {}`,
      );
    });
  });

  describe("string edge cases in type positions", () => {
    it("handles string with colon inside typed function", () => {
      expectErasure(
        `function f(x: string) { return "a: b" }`,
        `function f(x        ) { return "a: b" }`,
      );
    });

    it("handles template literal with type-like content after typed code", () => {
      expectErasure(
        "const x: string = `interface Foo {}`",
        "const x         = `interface Foo {}`",
      );
    });

    it("preserves string containing 'as' keyword", () => {
      const input = `const s = "cast as string"`;
      expectErasure(input, input);
    });
  });

  describe("multiline type aliases and interfaces", () => {
    it("erases multiline type alias", () => {
      const input = "type Config = {\n  host: string\n  port: number\n}";
      const result = eraseTsTypes(input);
      assert.strictEqual(result.length, input.length);
      assert.strictEqual(result[0], ";");
      assert.ok(!result.includes("host"));
    });

    it("erases multiline interface with methods", () => {
      const input =
        "interface Api {\n  get(id: string): Promise<Item>\n  set(id: string, value: Item): void\n}";
      const result = eraseTsTypes(input);
      assert.strictEqual(result.length, input.length);
      assert.strictEqual(result[0], ";");
      assert.ok(!result.includes("get"));
    });

    it("erases interface with optional properties", () => {
      expectErasure(
        `interface Opts { x?: number; y?: string }`,
        `;                                        `,
      );
    });

    it("erases interface with readonly properties", () => {
      expectErasure(
        `interface Point { readonly x: number; readonly y: number }`,
        `;                                                         `,
      );
    });

    it("erases interface extending multiple interfaces", () => {
      expectErasure(
        `interface C extends A, B { z: number }`,
        `;                                     `,
      );
    });

    it("erases interface with generic parameter", () => {
      expectErasure(
        `interface Box<T> { value: T }`,
        `;                            `,
      );
    });
  });

  describe("complex generic constraints", () => {
    it("erases generic with keyof constraint", () => {
      expectErasure(
        `function f<K extends keyof T>(key: K) {}`,
        `function f                   (key   ) {}`,
      );
    });

    it("erases generic with multiple constraints", () => {
      expectErasure(
        `function f<T extends A & B>(x: T) {}`,
        `function f                 (x   ) {}`,
      );
    });

    it("erases generic with braces in default", () => {
      expectErasure(
        `function f<T extends object = {}>(x: T) {}`,
        `function f                       (x   ) {}`,
      );
    });
  });

  describe("special JS constructs not confused with TS", () => {
    it("preserves for-in loop", () => {
      const input = `for (const k in obj) {}`;
      expectErasure(input, input);
    });

    it("preserves class with static method", () => {
      const input = `class C { static foo() { return 1 } }`;
      expectErasure(input, input);
    });

    it("preserves async arrow function", () => {
      const input = `const f = async () => await fetch(url)`;
      expectErasure(input, input);
    });

    it("preserves destructuring assignment with defaults", () => {
      const input = `const { a = 1, b = 2 } = obj`;
      expectErasure(input, input);
    });

    it("preserves nested destructuring", () => {
      const input = `const { a: { b } } = obj`;
      expectErasure(input, input);
    });

    it("preserves array destructuring with rest", () => {
      const input = `const [first, ...rest] = arr`;
      expectErasure(input, input);
    });

    it("preserves class with private field", () => {
      const input = `class C { #x = 1; get x() { return this.#x } }`;
      expectErasure(input, input);
    });

    it("preserves object with getter and setter", () => {
      const input = `const obj = { get x() { return 1 }, set x(v) {} }`;
      expectErasure(input, input);
    });

    it("preserves dynamic import", () => {
      const input = `const mod = await import("./mod")`;
      expectErasure(input, input);
    });

    it("preserves labeled break in nested loops", () => {
      const input = `outer: for (;;) { inner: for (;;) { break outer } }`;
      expectErasure(input, input);
    });

    it("preserves yield expression in generator", () => {
      const input = `function* g() { yield 1; yield* other() }`;
      expectErasure(input, input);
    });
  });

  describe("mixed type erasure and preservation", () => {
    it("erases type but preserves string with same content", () => {
      expectErasure(
        `const x: string = "const y: number = 5"`,
        `const x         = "const y: number = 5"`,
      );
    });

    it("erases type but preserves comment with same content", () => {
      expectErasure(
        `const x: string = 1 // x: number`,
        `const x         = 1 // x: number`,
      );
    });

    it("erases type but preserves block comment with same content", () => {
      expectErasure(
        `const x: string = 1 /* x: number */`,
        `const x         = 1 /* x: number */`,
      );
    });

    it("erases generic but preserves JSX-like content in string", () => {
      expectErasure(
        `const x = foo<string>("hello <div>")`,
        `const x = foo        ("hello <div>")`,
      );
    });
  });

  describe("void and never types", () => {
    it("erases void return type", () => {
      expectErasure(`function f(): void {}`, `function f()       {}`);
    });

    it("erases never return type", () => {
      expectErasure(
        `function f(): never { throw new Error() }`,
        `function f()        { throw new Error() }`,
      );
    });

    it("erases undefined type annotation", () => {
      expectErasure(
        `let x: undefined = undefined`,
        `let x            = undefined`,
      );
    });

    it("erases null type in union", () => {
      expectErasure(
        `let x: string | null = null`,
        `let x                = null`,
      );
    });
  });

  describe("complex nested expressions with types", () => {
    it("handles deeply nested function calls with generics", () => {
      expectErasure(`a<X>(b<Y>(c<Z>(d)))`, `a   (b   (c   (d)))`);
    });

    it("handles as expression in ternary", () => {
      expectErasure(
        `const x = cond ? (y as string) : z`,
        `const x = cond ? (y          ) : z`,
      );
    });

    it("handles non-null assertion in array access", () => {
      expectErasure(`const x = map.get(key)![0]`, `const x = map.get(key) [0]`);
    });

    it("handles satisfies followed by property access", () => {
      const input = `const x = (obj satisfies Foo).bar`;
      const result = eraseTsTypes(input);
      assert.strictEqual(result.length, input.length);
    });

    it("handles as with intersection type", () => {
      expectErasure(`const x = y as A & B`, `const x = y         `);
    });
  });

  describe("import and export edge cases", () => {
    it("preserves dynamic import expression", () => {
      const input = `const m = import("./foo")`;
      expectErasure(input, input);
    });

    it("preserves import with no braces", () => {
      const input = `import foo from "./bar"`;
      expectErasure(input, input);
    });

    it("preserves import with star", () => {
      const input = `import * as ns from "./bar"`;
      expectErasure(input, input);
    });

    it("preserves side-effect import", () => {
      const input = `import "./polyfill"`;
      expectErasure(input, input);
    });

    it("erases import type star as namespace", () => {
      const input = `import type * as Types from "./types"`;
      const result = eraseTsTypes(input);
      assert.strictEqual(result.length, input.length);
      assert.strictEqual(result[0], ";");
      assert.strictEqual(result.trim(), ";");
    });

    it("preserves export with 'as' rename of multiple items", () => {
      const input = `export { foo as default, bar as baz }`;
      expectErasure(input, input);
    });

    it("erases export type with 'from' clause", () => {
      const input = `export type { Config } from "./config"`;
      const result = eraseTsTypes(input);
      assert.strictEqual(result.length, input.length);
      assert.strictEqual(result[0], ";");
      assert.strictEqual(result.trim(), ";");
    });

    it("erases multiline export type with 'from' clause", () => {
      const input = `export type {\n  Foo,\n  Bar,\n  Baz\n} from "./types"`;
      const result = eraseTsTypes(input);
      assert.strictEqual(result.length, input.length);
      assert.ok(!result.includes("Foo"));
      assert.ok(!result.includes("Bar"));
      assert.ok(!result.includes("types"));
    });

    it("erases multiline import type", () => {
      const input = `import type {\n  Foo,\n  Bar\n} from "./types"`;
      const result = eraseTsTypes(input);
      assert.strictEqual(result.length, input.length);
      assert.ok(!result.includes("Foo"));
      assert.ok(!result.includes("Bar"));
      assert.ok(!result.includes("types"));
    });

    it("preserves re-export star", () => {
      const input = `export * from "./mod"`;
      expectErasure(input, input);
    });

    it("preserves re-export star as namespace", () => {
      const input = `export * as ns from "./mod"`;
      expectErasure(input, input);
    });
  });

  describe("whitespace and formatting edge cases", () => {
    it("handles extra whitespace around type annotation", () => {
      expectErasure(`const x :  string  = 1`, `const x            = 1`);
    });

    it("handles tab-indented interface", () => {
      const input = "\tinterface Foo { x: number }";
      const result = eraseTsTypes(input);
      assert.strictEqual(result.length, input.length);
      assert.strictEqual(result.trim(), ";");
    });

    it("handles CRLF line endings in multiline interface", () => {
      const input = "interface Foo {\r\n  bar: string\r\n}";
      const result = eraseTsTypes(input);
      assert.strictEqual(result.length, input.length);
    });

    it("handles multiple blank lines between constructs", () => {
      expectErasure(
        `type A = string\n\n\nconst x = 1`,
        `;              \n\n\nconst x = 1`,
      );
    });
  });

  describe("as/satisfies after literals", () => {
    it("erases as after double-quoted string literal", () => {
      expectErasure(
        `const x = "hello" as const`,
        `const x = "hello"         `,
      );
    });

    it("erases as after single-quoted string literal", () => {
      expectErasure(
        `const x = 'hello' as const`,
        `const x = 'hello'         `,
      );
    });

    it("erases as after template literal", () => {
      expectErasure(
        "const x = `hello` as string",
        "const x = `hello`          ",
      );
    });

    it("erases satisfies after double-quoted string literal", () => {
      expectErasure(
        `const x = "hello" satisfies string`,
        `const x = "hello"                 `,
      );
    });

    it("erases satisfies after template literal", () => {
      expectErasure(
        "const x = `hello` satisfies string",
        "const x = `hello`                 ",
      );
    });

    it("erases satisfies after closing bracket", () => {
      expectErasure(
        `const x = arr[0] satisfies string`,
        `const x = arr[0]                 `,
      );
    });
  });

  describe("non-null assertion edge cases", () => {
    it("erases non-null assertion before bracket access", () => {
      expectErasure(`arr[0]![0]`, `arr[0] [0]`);
    });
  });

  describe("template literal interpolation with comments", () => {
    it("preserves line comment inside template interpolation", () => {
      const input = "const s = `${// comment\nx}`";
      expectErasure(input, input);
    });

    it("preserves block comment inside template interpolation", () => {
      const input = "const s = `${/* comment */x}`";
      expectErasure(input, input);
    });

    it("erases type annotation including comment inside annotation range", () => {
      expectErasure(
        "tag`${(x: number /* typed */) => x}`",
        "tag`${(x                    ) => x}`",
      );
    });
  });

  describe("inline type specifier edge cases", () => {
    it("erases single type-only specifier with no value imports", () => {
      expectErasure(
        `import { type Foo } from "./bar"`,
        `import {          } from "./bar"`,
      );
    });

    it("handles empty import braces", () => {
      const input = `import {} from "./mod"`;
      expectErasure(input, input);
    });
  });

  describe("export type edge cases", () => {
    it("does not erase export when type is not followed by = or <", () => {
      const input = `export type\nconst x = 1`;
      const result = eraseTsTypes(input);
      assert.strictEqual(result.length, input.length);
      assert.ok(result.includes("const x = 1"));
    });
  });

  describe("ternary inside parentheses", () => {
    it("preserves ternary outside parens", () => {
      const input = `const x = cond ? a : b`;
      expectErasure(input, input);
    });

    it("preserves ternary with string values inside parens", () => {
      const input = `foo(cond ? "a" : "b")`;
      expectErasure(input, input);
    });

    it("preserves ternary with non-identifier colon preceded by closing paren", () => {
      const input = `const x = foo() ? true : false`;
      expectErasure(input, input);
    });
  });

  describe("nested destructuring parameter types", () => {
    it("erases type on nested object destructuring parameter", () => {
      expectErasure(
        `function f({ a: { b } }: T) {}`,
        `function f({ a: { b } }   ) {}`,
      );
    });

    it("preserves destructuring alias colon inside object pattern", () => {
      expectErasure(
        `function f({ a: b }: T) {}`,
        `function f({ a: b }   ) {}`,
      );
    });
  });

  describe("declare with following code", () => {
    it("erases declare with semicolon followed by code", () => {
      expectErasure(
        `declare const x: string;\nconst y = 1`,
        `;                       \nconst y = 1`,
      );
    });
  });

  describe("generic vs comparison disambiguation", () => {
    it("erases identifier-preceded angle brackets as generic", () => {
      expectErasure(`a<b>(x)`, `a   (x)`);
    });

    it("does not erase less-than when not preceded by identifier", () => {
      const input = `if (1 < 2) {}`;
      expectErasure(input, input);
    });

    it("does not erase when closing angle is followed by non-generic token", () => {
      const input = `if (a<b>c) {}`;
      expectErasure(input, input);
    });
  });

  describe("amaro parity", () => {
    describe("class access modifiers", () => {
      it("erases private on constructor", () => {
        expectErasure(
          `class Foo { private constructor() {} }`,
          `class Foo {         constructor() {} }`,
        );
      });

      it("erases public on method", () => {
        expectErasure(
          `class Foo { public greet() {} }`,
          `class Foo {        greet() {} }`,
        );
      });

      it("erases protected on method", () => {
        expectErasure(
          `class Foo { protected greet() {} }`,
          `class Foo {           greet() {} }`,
        );
      });

      it("erases multiple modifiers on different members", () => {
        expectErasure(
          `class C { private a() {} public b() {} protected c() {} }`,
          `class C {         a() {}        b() {}           c() {} }`,
        );
      });

      it("erases modifier on private field", () => {
        expectErasure(
          `class C { private #x = 1 }`,
          `class C {         #x = 1 }`,
        );
      });

      it("does not erase private after dot", () => {
        const input = `obj.private`;
        expectErasure(input, input);
      });

      it("does not erase public outside class", () => {
        const input = `const public = 1`;
        expectErasure(input, input);
      });
    });

    describe("class member modifiers", () => {
      it("erases readonly on a field", () => {
        expectErasure(
          `class C { readonly x = 1 }`,
          `class C {          x = 1 }`,
        );
      });

      it("erases readonly and keeps static", () => {
        expectErasure(
          `class C { static readonly x: number = 1 }`,
          `class C { static          x         = 1 }`,
        );
      });

      it("erases access modifier with readonly", () => {
        expectErasure(
          `class C { private readonly x: string }`,
          `class C {                  x         }`,
        );
      });

      it("erases override on a method", () => {
        expectErasure(
          `class C extends B { override foo() {} }`,
          `class C extends B {          foo() {} }`,
        );
      });

      it("erases a full modifier chain", () => {
        expectErasure(
          `class C extends B { public static override readonly x = 1 }`,
          `class C extends B {        static                   x = 1 }`,
        );
      });

      it("erases readonly on a private field", () => {
        expectErasure(
          `class C { readonly #x = 1 }`,
          `class C {          #x = 1 }`,
        );
      });

      it("erases optional marker after a modifier", () => {
        expectErasure(
          `class C { readonly x?: number }`,
          `class C {          x          }`,
        );
      });

      it("erases definite assignment marker after a modifier", () => {
        expectErasure(
          `class C { private x!: number; y = 1 }`,
          `class C {         x         ; y = 1 }`,
        );
      });

      it("erases annotation on a quoted member name", () => {
        expectErasure(
          `class C { readonly "a"?: number = 1 }`,
          `class C {          "a"          = 1 }`,
        );
      });

      it("keeps a semicolon before a computed member", () => {
        expectErasure(
          `class C {\n  x = 1\n  readonly [k] = 2\n}`,
          `class C {\n  x = 1\n  ;        [k] = 2\n}`,
        );
      });

      it("keeps a semicolon before a generator member", () => {
        expectErasure(
          `class C { override *gen() {} }`,
          `class C { ;        *gen() {} }`,
        );
      });

      it("erases modifier after a line comment", () => {
        expectErasure(
          `class C {\n  // why?\n  readonly x = 1\n}`,
          `class C {\n  // why?\n           x = 1\n}`,
        );
      });

      it("erases modifier after a block comment", () => {
        expectErasure(
          `class C { /** doc */ readonly x = 1 }`,
          `class C { /** doc */          x = 1 }`,
        );
      });

      it("erases modifiers in nested classes", () => {
        expectErasure(
          `class A { m() { return class { readonly x = 1 } } readonly y = 2 }`,
          `class A { m() { return class {          x = 1 } }          y = 2 }`,
        );
      });

      it("erases modifiers in a class passed as an argument", () => {
        expectErasure(
          `f(class { readonly x = 1 })`,
          `f(class {          x = 1 })`,
        );
      });

      it("finds the class body past a heritage call", () => {
        expectErasure(
          `class C extends mixin({ a: 1 }) { readonly x = 1 }`,
          `class C extends mixin({ a: 1 }) {          x = 1 }`,
        );
      });

      it("erases a readonly index signature", () => {
        expectErasure(
          `class C { readonly [key: string]: number; x = 1 }`,
          `class C { ;                               x = 1 }`,
        );
      });

      it("erases modifier on a computed symbol member", () => {
        expectErasure(
          `class C { readonly [Symbol.iterator] = 1 }`,
          `class C { ;        [Symbol.iterator] = 1 }`,
        );
      });

      it("treats modifier words as member names", () => {
        const input = `class C { readonly = 1; abstract() {} }`;
        expectErasure(input, input);
      });

      it("does not treat a modifier followed by a newline as a modifier", () => {
        const input = `class C {\n  readonly\n  x = 1\n}`;
        expectErasure(input, input);
      });

      it("does not erase modifier words in a field initializer", () => {
        expectErasure(
          `class C { x = readonly as Foo }`,
          `class C { x = readonly        }`,
        );
      });

      it("does not erase modifier words outside class bodies", () => {
        const input = `function f() { const readonly = 1; return readonly }`;
        expectErasure(input, input);
      });

      it("does not erase modifier words in object literals", () => {
        const input = `const o = { class: { readonly: 1, abstract: true } }`;
        expectErasure(input, input);
      });

      it("preserves static blocks", () => {
        const input = `class C { static { init() } }`;
        expectErasure(input, input);
      });

      it("leaves constructor parameter properties for the runtime to reject", () => {
        expectErasure(
          `class C { constructor(private readonly x: string) {} }`,
          `class C { constructor(private readonly x        ) {} }`,
        );
      });
    });

    describe("abstract classes", () => {
      it("erases abstract before class", () => {
        expectErasure(`abstract class A {}`, `         class A {}`);
      });

      it("erases abstract after export", () => {
        expectErasure(`export abstract class A {}`, `export          class A {}`);
      });

      it("erases abstract after export default", () => {
        expectErasure(
          `export default abstract class {}`,
          `export default          class {}`,
        );
      });

      it("erases abstract in a class expression", () => {
        expectErasure(
          `const A = abstract class {}`,
          `const A =          class {}`,
        );
      });

      it("erases an abstract method and keeps concrete members", () => {
        expectErasure(
          `abstract class A { abstract foo(): void; bar() {} }`,
          `         class A { ;                     bar() {} }`,
        );
      });

      it("erases an abstract field before the closing brace", () => {
        expectErasure(
          `abstract class A { abstract x: number }`,
          `         class A { ;                  }`,
        );
      });

      it("erases an abstract member ended by a newline", () => {
        expectErasure(
          `abstract class A {\n  abstract foo(): void\n  bar() {}\n}`,
          `         class A {\n  ;                   \n  bar() {}\n}`,
        );
      });

      it("erases modifiers preceding abstract", () => {
        expectErasure(
          `abstract class A { protected abstract get x(): number; }`,
          `         class A { ;                                   }`,
        );
      });

      it("erases an abstract member with a multi-line union", () => {
        expectErasure(
          `abstract class A {\n  abstract x:\n    | string\n    | number\n  y = 1\n}`,
          `         class A {\n  ;          \n            \n            \n  y = 1\n}`,
        );
      });

      it("does not erase a variable named abstract", () => {
        const input = `const abstract = 1`;
        expectErasure(input, input);
      });
    });

    describe("declare class fields", () => {
      it("erases a declare field and keeps the closing brace", () => {
        expectErasure(
          `class C { declare x: string }`,
          `class C { ;                 }`,
        );
      });

      it("erases a declare field after another modifier", () => {
        expectErasure(
          `class C { public declare x: string; y = 1 }`,
          `class C { ;                         y = 1 }`,
        );
      });
    });

    describe("generic arrow after return/throw/yield", () => {
      it("erases generic arrow in return statement", () => {
        expectErasure(
          `function f() { return <T>(x: T)=>x }`,
          `function f() { return    (x   )=>x }`,
        );
      });

      it("erases generic arrow in throw statement", () => {
        expectErasure(
          `function f() { throw <T>(x: T)=>x }`,
          `function f() { throw    (x   )=>x }`,
        );
      });

      it("erases generic arrow in yield statement", () => {
        expectErasure(
          `function* f() { yield <T>(x: T)=>x }`,
          `function* f() { yield    (x   )=>x }`,
        );
      });
    });

    describe("nested generic type parameters", () => {
      it("erases nested generics in constructor call", () => {
        expectErasure(
          `const w = new Wrapper<string>(x)`,
          `const w = new Wrapper        (x)`,
        );
      });
    });

    describe("method overload signatures", () => {
      it("erases overload signatures and keeps implementation", () => {
        expectErasure(
          `class C { foo(x: string): string; foo(x: number): number; foo(x: string | number): string | number { return x } }`,
          `class C { ;                       ;                       foo(x                 )                  { return x } }`,
        );
      });

      it("erases overload signatures ended by newlines", () => {
        expectErasure(
          `class C {\n  foo(x: string): string\n  foo(x: number): number\n  foo(x: unknown) { return x }\n}`,
          `class C {\n  ;                     \n  ;                     \n  foo(x         ) { return x }\n}`,
        );
      });

      it("erases constructor overloads", () => {
        expectErasure(
          `class C { constructor(x: string); constructor(x: unknown) {} }`,
          `class C { ;                       constructor(x         ) {} }`,
        );
      });

      it("erases overloads with modifiers", () => {
        expectErasure(
          `class C { public foo(x: string): void; public foo(x: unknown) {} }`,
          `class C { ;                                   foo(x         ) {} }`,
        );
      });

      it("keeps a method with its brace on the next line", () => {
        const input = `class C { foo()\n{ return 1 } }`;
        expectErasure(input, input);
      });

      it("does not treat a field initializer call as an overload", () => {
        const input = `class C { x = foo(1); y = 2 }`;
        expectErasure(input, input);
      });
    });

    describe("class fields", () => {
      it("erases annotations on fields without modifiers", () => {
        expectErasure(
          `class C { x: number = 1; y?: string; z!: boolean }`,
          `class C { x         = 1; y         ; z           }`,
        );
      });

      it("erases annotations on fields ended by newlines", () => {
        expectErasure(
          `class C {\n  x: number\n  y: string\n}`,
          `class C {\n  x        \n  y        \n}`,
        );
      });

      it("erases annotations on keyword and quoted field names", () => {
        expectErasure(
          `class C { type: string; "a": number }`,
          `class C { type        ; "a"         }`,
        );
      });

      it("erases multi-line union field types", () => {
        expectErasure(
          `class C {\n  x:\n    | string\n    | number\n  y = 1\n}`,
          `class C {\n  x \n            \n            \n  y = 1\n}`,
        );
      });

      it("erases an index signature without modifiers", () => {
        expectErasure(
          `class C { [key: string]: number; x = 1 }`,
          `class C { ;                      x = 1 }`,
        );
      });

      it("does not treat object literal values as field types", () => {
        const input = `class C { x = { a: 1 } }`;
        expectErasure(input, input);
      });

      it("does not treat a continued ternary as a field", () => {
        const input = `class C {\n  x = a ?\n    b : c\n}`;
        expectErasure(input, input);
      });

      it("does not treat a template interpolation as a member", () => {
        const input = "class C { x = `${foo(1)}`; }";
        expectErasure(input, input);
      });

      it("still erases casts on a continued line", () => {
        expectErasure(
          `class C { x = y\n  as Foo }`,
          `class C { x = y\n         }`,
        );
      });
    });

    describe("object return types", () => {
      it("erases an object return type on a function", () => {
        expectErasure(
          `function f(): { a: string } { return x }`,
          `function f()                { return x }`,
        );
      });

      it("erases a union ending in an object return type", () => {
        expectErasure(
          `function f(): A | { a: string } { return x }`,
          `function f()                    { return x }`,
        );
      });

      it("erases an object return type on a method", () => {
        expectErasure(
          `class C { foo(): { a: string } { return x } }`,
          `class C { foo()                { return x } }`,
        );
      });

      it("erases an object return type on an arrow function", () => {
        expectErasure(
          `const f = (): { a: string } => x`,
          `const f = ()                => x`,
        );
      });

      it("erases a function overload returning an object type", () => {
        expectErasure(
          `function f(): { a: string };\nfunction f() {}`,
          `;                           \nfunction f() {}`,
        );
      });

      it("erases a method overload returning a union with an object", () => {
        expectErasure(
          `class C { foo(): A | { a: string }; foo() {} }`,
          `class C { ;                         foo() {} }`,
        );
      });

      it("does not treat an object after a ternary colon as a type", () => {
        const input = `const y = c ? f({ a }) : { b }`;
        expectErasure(input, input);
      });
    });

    describe("return types inside calls", () => {
      it("keeps the arrow body after a return type", () => {
        expectErasure(
          `arr.map((x): string => x)`,
          `arr.map((x)         => x)`,
        );
      });

      it("keeps later arguments after an arrow with a return type", () => {
        expectErasure(
          `f((x: string): number => x, 1)`,
          `f((x        )         => x, 1)`,
        );
      });

      it("erases a generic return type on an async arrow", () => {
        expectErasure(
          `f(async (x): Promise<string> => x)`,
          `f(async (x)                  => x)`,
        );
      });

      it("erases an object return type on an arrow", () => {
        expectErasure(
          `f((x): { a: string } => x)`,
          `f((x)                => x)`,
        );
      });

      it("keeps a function expression body", () => {
        expectErasure(
          `f(function (x): void {})`,
          `f(function (x)       {})`,
        );
      });

      it("keeps an object method body", () => {
        expectErasure(
          `f({ m(x): void { return 1 } })`,
          `f({ m(x)       { return 1 } })`,
        );
      });

      it("does not treat a ternary in a call as a return type", () => {
        const input = `f(c ? g(x) : y)`;
        expectErasure(input, input);
      });
    });

    describe("case labels", () => {
      it("keeps a block after a call in a case label", () => {
        const input = `switch (x) { case f(y): { break } }`;
        expectErasure(input, input);
      });

      it("keeps a block after a parenthesized case label", () => {
        const input = `switch (x) { case (y): { break } }`;
        expectErasure(input, input);
      });

      it("keeps a block after an indexed case label", () => {
        const input = `switch (x) { case a[0]: { break } }`;
        expectErasure(input, input);
      });

      it("erases types after a case label", () => {
        expectErasure(
          `switch (x) { case 1: f((y): void => y) }`,
          `switch (x) { case 1: f((y)       => y) }`,
        );
      });

      it("erases a return type after a comment mentioning case", () => {
        expectErasure(
          `// in case\nfunction f(): void {}`,
          `// in case\nfunction f()       {}`,
        );
      });

      it("does not treat case properties as labels", () => {
        const input = `const o = { case: 1 }; o.case`;
        expectErasure(input, input);
      });

      it("erases annotations after a field named case", () => {
        expectErasure(
          `class C { case = 1; x: number }`,
          `class C { case = 1; x         }`,
        );
      });
    });

    describe("ternaries inside parentheses", () => {
      const preserved = [
        `foo(a ? b : c)`,
        `foo(a ? 1 : 2)`,
        `foo(a ? b.c : d)`,
        `foo(x, a ? b : c)`,
        `foo([a ? b : c])`,
        `f((a ? b : c), d)`,
        `if (a ? b : c) {}`,
      ];
      for (const input of preserved) {
        it(`preserves ${input}`, () => {
          expectErasure(input, input);
        });
      }

      it("erases a parameter annotation inside a ternary branch", () => {
        expectErasure(
          `foo(a ? (x: string) => x : y)`,
          `foo(a ? (x        ) => x : y)`,
        );
      });

      it("erases parameters after an optional parameter", () => {
        expectErasure(
          `function f(a?: string, b: number) {}`,
          `function f(a         , b        ) {}`,
        );
      });

      it("erases parameters after a ternary default", () => {
        expectErasure(
          `(a = b ? c : d, e: T) => a`,
          `(a = b ? c : d, e   ) => a`,
        );
      });

      it("ignores a question mark in a comment between parameters", () => {
        expectErasure(
          `function f(// why?\n  b: string) {}`,
          `function f(// why?\n  b        ) {}`,
        );
      });

      it("ignores an apostrophe in a comment between parameters", () => {
        expectErasure(
          `function f(\n  // don't\n  b: string,\n): void {}`,
          `function f(\n  // don't\n  b        ,\n)       {}`,
        );
      });
    });

    describe("case labels and switch bodies", () => {
      it("erases the return type of an object method named case", () => {
        expectErasure(
          `const o = { case(x: string): void {} }`,
          `const o = { case(x        )       {} }`,
        );
      });

      it("finds the switch body past a comparison", () => {
        const input = `switch (a < b) { case (x): { break } }`;
        expectErasure(input, input);
      });

      it("tracks nested switches", () => {
        const input = `switch (x) { case 1: switch (y) { case g(z): { break } } case 2: { break } }`;
        expectErasure(input, input);
      });

      it("handles a switch inside a typed function", () => {
        expectErasure(
          `function f(x: A) { switch (x) { case g(y): { return 1 } default: return 2 } }`,
          `function f(x   ) { switch (x) { case g(y): { return 1 } default: return 2 } }`,
        );
      });
    });

    describe("class header expressions", () => {
      it("finds the body past a comparison in parentheses", () => {
        expectErasure(
          `class A extends (a < b ? C : D) { readonly x = 1 }`,
          `class A extends (a < b ? C : D) {          x = 1 }`,
        );
      });

      it("finds the body past a comparison in brackets", () => {
        expectErasure(
          `class A extends m[a < b ? 0 : 1] { readonly x = 1 }`,
          `class A extends m[a < b ? 0 : 1] {          x = 1 }`,
        );
      });

      it("finds the body past a parenthesized class", () => {
        expectErasure(
          `class A extends (class B<T> {}) { readonly x: T = 1 }`,
          `class A extends (class B    {}) {          x    = 1 }`,
        );
      });

      it("finds the body past a brace in a string", () => {
        expectErasure(
          `class A extends m("{") { readonly x = 1 }`,
          `class A extends m("{") {          x = 1 }`,
        );
      });
    });

    describe("multi-line conditional type aliases", () => {
      it("erases branches on their own lines", () => {
        expectErasure(
          `type A<T> = T extends string\n  ? (T & {})["a"]\n  : { b: T }\nconst x = 1`,
          `;                           \n                 \n            \nconst x = 1`,
        );
      });

      it("erases an extends clause on its own line", () => {
        expectErasure(
          `type A<T> = T\n  extends string ? 1 : 2\nconst x = 1`,
          `;            \n                        \nconst x = 1`,
        );
      });
    });

    describe("keywords at the end of identifiers", () => {
      const preserved = [
        `const deltas = parts`,
        `canvas.getContext("2d")`,
        `Flag.withAlias("w")`,
        `$as(x)`,
        `const myinterface = 1`,
        `reimport(x)`,
        `const unsatisfies = 1; unsatisfies.x`,
        `const redeclare = 1`,
        `const subtype = x`,
        `reexport(x)`,
      ];
      for (const input of preserved) {
        it(`preserves ${input}`, () => {
          expectErasure(input, input);
        });
      }

      it("preserves a name ending in type before an alias shape", () => {
        const input = `subtype Foo = 1`;
        expectErasure(input, input);
      });

      it("still erases a real cast after such a name", () => {
        expectErasure(`deltas as Foo`, `deltas       `);
      });
    });

    describe("callback bodies", () => {
      it("erases a local annotation inside a callback", () => {
        expectErasure(
          `foo(() => { const a: string = "x"; return a })`,
          `foo(() => { const a         = "x"; return a })`,
        );
      });

      it("erases a local annotation inside a function expression", () => {
        expectErasure(
          `foo(function () { let a: number; a = 1 })`,
          `foo(function () { let a        ; a = 1 })`,
        );
      });

      it("erases a local annotation after an else brace", () => {
        expectErasure(
          `foo(() => { if (a) { b() } else { const c: T = 1 } })`,
          `foo(() => { if (a) { b() } else { const c    = 1 } })`,
        );
      });

      it("erases a local annotation in a case block", () => {
        expectErasure(
          `foo(() => { switch (a) { case 1: { const b: T = 1 } } })`,
          `foo(() => { switch (a) { case 1: { const b    = 1 } } })`,
        );
      });

      it("erases a local annotation in a default block", () => {
        expectErasure(
          `foo(() => { switch (a) { default: { const b: T = 1 } } })`,
          `foo(() => { switch (a) { default: { const b    = 1 } } })`,
        );
      });

      it("keeps object keys inside a callback", () => {
        const input = `foo(() => { return { a: 1, b: 2 } })`;
        expectErasure(input, input);
      });
    });

    describe("object literals", () => {
      const preserved = [
        `const o = { ...s, [key]: value }`,
        `foo({ [k]: v })`,
        `const o = { [a]: b ? c : d }`,
        `export const { $match: match } = x`,
        `const { a: b, c: d } = e`,
        `export default { a: 1 }`,
        `function f() { return { [a]: b } }`,
        `const x = a ? { b: 1 } : { c: 2 }`,
      ];
      for (const input of preserved) {
        it(`preserves ${input}`, () => {
          expectErasure(input, input);
        });
      }

      it("erases a method return type in an object", () => {
        expectErasure(
          `const o = { m(x: A): B { return x } }`,
          `const o = { m(x   )    { return x } }`,
        );
      });
    });

    describe("regular expression literals", () => {
      const preserved = [
        `const a = /[&<>"']/g`,
        String.raw`const a = s.match(/^\/a(?:\/([^/]+))?$/)`,
        `s.replace(/'/g, "x")`,
        `return /a:b/.test(s)`,
        `const a = b / c / d`,
        `const a = (b) / c`,
        `const a = /[/]/`,
      ];
      for (const input of preserved) {
        it(`preserves ${input}`, () => {
          expectErasure(input, input);
        });
      }

      it("keeps erasing after a regex with quotes", () => {
        expectErasure(
          `s.replace(/"/g, (c: string): string => c)`,
          `s.replace(/"/g, (c        )         => c)`,
        );
      });
    });

    describe("non-null assertions", () => {
      const preserved = [
        `function f(x) { return !x }`,
        `function* f(x) { yield !x }`,
        `function f(x) { throw !x }`,
        `typeof !x`,
        `a\n!b`,
        `a !== b`,
        `a != b`,
      ];
      for (const input of preserved) {
        it(`preserves ${JSON.stringify(input)}`, () => {
          expectErasure(input, input);
        });
      }

      it("erases an assertion on a property named like a keyword", () => {
        expectErasure(`iter.return!()`, `iter.return ()`);
      });

      it("erases an assertion before a cast", () => {
        expectErasure(`m.get(k)! as any`, `m.get(k)        `);
      });

      it("erases a definite let declaration", () => {
        expectErasure(`let a!: string\nb()`, `let a         \nb()`);
      });

      it("erases a definite var declaration", () => {
        expectErasure(`var a!: string`, `var a         `);
      });
    });

    describe("generic detection", () => {
      const preserved = [
        `a < b > c`,
        `if (a < b && c > d) {}`,
        `if (a < b || c > d) {}`,
        `a <= b`,
        `a << 11`,
        `a ^= b << 11\nc > (d)`,
        `const x = (a >>> 0) < (b >>> 0)\n  ? c\n  : d`,
        `for (let i = 0; i < n; i++) { if (a > b) {} }`,
        `a < b; c > (d)`,
      ];
      for (const input of preserved) {
        it(`preserves ${JSON.stringify(input)}`, () => {
          expectErasure(input, input);
        });
      }

      it("erases object type arguments", () => {
        expectErasure(
          `new Map<string, { a: string }>()`,
          `new Map                       ()`,
        );
      });

      it("erases multi-line type arguments", () => {
        expectErasure(`sql<{\n  a: string\n}>\`x\``, `sql  \n           \n  \`x\``);
      });

      it("erases function type arguments", () => {
        expectErasure(`f<() => void>(x)`, `f            (x)`);
      });

      it("erases type parameters on a generic arrow", () => {
        expectErasure(`dual(2, <A>(x: A) => x)`, `dual(2,    (x   ) => x)`);
      });

      it("erases type parameters with a trailing comma", () => {
        expectErasure(`const f = <T,>(x: T) => x`, `const f =     (x   ) => x`);
      });

      it("erases type parameters on a generator", () => {
        expectErasure(`function*<T>(x: T) {}`, `function*   (x   ) {}`);
      });

      it("erases a default type parameter", () => {
        expectErasure(`function f<T = string>() {}`, `function f            () {}`);
      });
    });

    describe("function type return types", () => {
      it("erases a function type return", () => {
        expectErasure(
          `function f(): (a: A) => B { return x }`,
          `function f()              { return x }`,
        );
      });

      it("erases a generic function type return", () => {
        expectErasure(
          `function f(): <T>(a: T) => T { return x }`,
          `function f()                 { return x }`,
        );
      });

      it("erases a function type returning an object", () => {
        expectErasure(
          `function f(): () => { a: 1 } { return x }`,
          `function f()                 { return x }`,
        );
      });

      it("keeps the arrow after a parenthesized return type", () => {
        expectErasure(`const f = (x): (A | B) => x`, `const f = (x)          => x`);
      });

      it("erases a type predicate with an object", () => {
        expectErasure(
          `function f(x): x is { a: 1 } { return x }`,
          `function f(x)                { return x }`,
        );
      });

      it("moves the paren next to the arrow over a multi-line return type", () => {
        expectErasure(
          `const f = (\n  a: A\n): B<\n  C\n> => a`,
          `const f = (\n  a   \n     \n   \n )=> a`,
        );
      });
    });

    describe("this parameters", () => {
      it("erases a lone this parameter", () => {
        expectErasure(`function f(this: A) {}`, `function f(       ) {}`);
      });

      it("erases a this parameter before other parameters", () => {
        expectErasure(`function f(this: A, b: B) {}`, `function f(         b   ) {}`);
      });

      it("erases a this parameter on a method", () => {
        expectErasure(
          `class C { m(this: A): void {} }`,
          `class C { m(       )       {} }`,
        );
      });

      it("does not erase this in a parenthesized ternary", () => {
        const input = `const a = (this ? b : c)`;
        expectErasure(input, input);
      });
    });

    describe("interfaces with object types in the header", () => {
      it("erases the whole interface", () => {
        expectErasure(
          `interface A<T extends { b: 1 }> { c: T }\nconst x = 1`,
          `;                                       \nconst x = 1`,
        );
      });

      it("erases an exported interface", () => {
        expectErasure(
          `export interface A<T extends { b: 1 }> { c: T }\nconst x = 1`,
          `;                                              \nconst x = 1`,
        );
      });

      it("does not treat a variable named interface as a declaration", () => {
        const input = `interface = 1`;
        expectErasure(input, input);
      });
    });

    describe("overloads without semicolons", () => {
      it("erases a function overload ended by a newline", () => {
        expectErasure(
          `function f(x: A): B\nfunction f(x) { return x }`,
          `;                  \nfunction f(x) { return x }`,
        );
      });

      it("erases an exported overload", () => {
        expectErasure(
          `export function f(x: A): B\nexport function f(x) { return x }`,
          `;                         \nexport function f(x) { return x }`,
        );
      });

      it("erases a generic overload", () => {
        expectErasure(
          `function f<T>(x: T): T;\nfunction f(x) { return x }`,
          `;                      \nfunction f(x) { return x }`,
        );
      });

      it("erases an async overload", () => {
        expectErasure(
          `async function f(x: A): B\nasync function f(x) { return x }`,
          `;                        \nasync function f(x) { return x }`,
        );
      });

      it("erases an async method overload", () => {
        expectErasure(
          `class C { async m(x: A): B; async m(x) {} }`,
          `class C { ;                 async m(x) {} }`,
        );
      });
    });

    describe("type specifiers with aliases", () => {
      it("erases an aliased type specifier at the end", () => {
        expectErasure(
          `import { a, type B as C } from "./x"`,
          `import { a              } from "./x"`,
        );
      });

      it("keeps a type specifier named as", () => {
        expectErasure(
          `import { type as, b } from "./x"`,
          `import {          b } from "./x"`,
        );
      });
    });

    describe("type-only namespaces", () => {
      it("erases a namespace containing only types", () => {
        expectErasure(
          `namespace A { export type B = 1 }\nconst x = 1`,
          `;                                \nconst x = 1`,
        );
      });

      it("erases an exported namespace with comments", () => {
        expectErasure(
          `export namespace A {\n  /** doc */\n  export interface B {}\n}\nconst x = 1`,
          `;                   \n            \n                       \n \nconst x = 1`,
        );
      });

      it("keeps a namespace with runtime code", () => {
        const input = `namespace A { export const b = 1 }`;
        expectErasure(input, input);
      });

      it("keeps a variable named namespace", () => {
        const input = `const namespace = {}`;
        expectErasure(input, input);
      });
    });

    describe("keywords used as names", () => {
      const preserved = [
        `const as = 1`,
        `export const as = 1`,
        `export const satisfies = () => 1`,
        `function f() { return as(1) }`,
        `export function declare(x) {}`,
        `import.meta.url`,
        `const a = await import("./a.ts")`,
      ];
      for (const input of preserved) {
        it(`preserves ${input}`, () => {
          expectErasure(input, input);
        });
      }

      it("erases a cast on import.meta", () => {
        expectErasure(`(import.meta as any).env`, `(import.meta       ).env`);
      });
    });

    describe("casts", () => {
      it("stops before a nullish operator", () => {
        expectErasure(`a as string ?? b`, `a           ?? b`);
      });

      it("stops before a ternary", () => {
        expectErasure(`a as boolean ? b : c`, `a            ? b : c`);
      });

      it("erases a cast after a postfix increment", () => {
        expectErasure(`a++ as B`, `a++     `);
      });

      it("erases a multi-line union cast", () => {
        expectErasure(
          `const a = b as\n  | C\n  | D\ne()`,
          `const a = b   \n     \n     \ne()`,
        );
      });

      it("erases a const cast in a ternary branch", () => {
        expectErasure(
          `f(a ? { b } as const : { c } as const)`,
          `f(a ? { b }          : { c }         )`,
        );
      });
    });

    describe("ternaries", () => {
      const preserved = [
        `const a = b ? c + 1 : d`,
        "const a = b ? `${c}`.d(1) : `${e}`",
        `const a = b ? f("\\n", c) : d`,
        `const a = b ? c : d ? e : f`,
      ];
      for (const input of preserved) {
        it(`preserves ${JSON.stringify(input)}`, () => {
          expectErasure(input, input);
        });
      }

      it("erases type arguments inside a ternary branch", () => {
        expectErasure(
          `const a = b\n  ? f<C, D>(e) :\n  g`,
          `const a = b\n  ? f      (e) :\n  g`,
        );
      });

      it("erases an arrow return type after an earlier ternary line", () => {
        expectErasure(
          `const a = b ? c : d\nconst e = (f): G => f`,
          `const a = b ? c : d\nconst e = (f)    => f`,
        );
      });

      it("erases a return type after a comment ending the previous line", () => {
        expectErasure(
          `const a = b ? c : d\n/** e? */\nconst f = (g): H => g`,
          `const a = b ? c : d\n/** e? */\nconst f = (g)    => g`,
        );
      });

      it("ignores a question mark in an erased type", () => {
        expectErasure(
          `type A = { b?: 1 }\nfunction f(c: () => void): void {}`,
          `;                 \nfunction f(c            )       {}`,
        );
      });

      it("erases an arrow return type in the first branch", () => {
        expectErasure(
          `const a = b\n  ? (c: D): E => { return c }\n  : f`,
          `const a = b\n  ? (c   )    => { return c }\n  : f`,
        );
      });

      it("keeps a ternary followed by an arrow in a later ternary", () => {
        const input = `const a = b ? new C(d) : e\nconst f = g\n  ? (h) => { return h }\n  : i`;
        expectErasure(input, input);
      });

      it("keeps an arrow as the second branch of a ternary", () => {
        const input = `const a = b ? (c) : d => { return d }`;
        expectErasure(input, input);
      });

      it("erases an arrow return type in the second branch", () => {
        expectErasure(
          `const a = b ? c : (d): E => d`,
          `const a = b ? c : (d)    => d`,
        );
      });
    });

    describe("multi-line types", () => {
      it("erases a conditional annotation on several lines", () => {
        expectErasure(
          `const a: B extends C\n  ? D\n  : E = f`,
          `const a             \n     \n      = f`,
        );
      });

      it("erases a type alias with a comment between union members", () => {
        expectErasure(
          `type A = { b: 1 } /** c; */\n  | D\nconst x = 1`,
          `;                          \n     \nconst x = 1`,
        );
      });

      it("erases an alias continued after extends", () => {
        expectErasure(
          `type A<T> = T extends\n  B<infer C> ? C : never\nconst x = 1`,
          `;                    \n                        \nconst x = 1`,
        );
      });

      it("erases a template literal type containing a semicolon", () => {
        expectErasure(
          "type A = `${B};${C}`\nconst x = 1",
          ";                   \nconst x = 1",
        );
      });
    });

    describe("keywords after comments ending in a period", () => {
      it("erases declare", () => {
        expectErasure(
          `// a comment.\ndeclare const b: C`,
          `// a comment.\n;                 `,
        );
      });

      it("erases a type alias", () => {
        expectErasure(`// a comment.\ntype B = C`, `// a comment.\n;         `);
      });

      it("erases an interface", () => {
        expectErasure(
          `// a comment.\ninterface B {}`,
          `// a comment.\n;             `,
        );
      });

      it("still treats a dotted name on the next line as a property", () => {
        const input = `a.\n  type = 1`;
        expectErasure(input, input);
      });
    });

    describe("class header generics", () => {
      it("erases a type parameter constrained by an object type", () => {
        expectErasure(
          `class C<T extends { a: string }> {}`,
          `class C                          {}`,
        );
      });

      it("erases an object type argument on the base class", () => {
        expectErasure(
          `class C extends Base<{ a: 1 }> { x = 1 }`,
          `class C extends Base           { x = 1 }`,
        );
      });

      it("erases an object type argument on a heritage call", () => {
        expectErasure(
          `class C extends mixin<{ a: 1 }>(Base) {}`,
          `class C extends mixin          (Base) {}`,
        );
      });
    });

    describe("members named like statement keywords", () => {
      it("keeps fields and methods named after keywords", () => {
        const input = `class C { interface = 1; declare = 2; declare() {} import() {} }`;
        expectErasure(input, input);
      });

      it("keeps a keyword-named field after a modifier", () => {
        expectErasure(
          `class C { static interface = 1; readonly function = 2 }`,
          `class C { static interface = 1;          function = 2 }`,
        );
      });
    });

    describe("class heritage", () => {
      it("erases implements with several interfaces", () => {
        expectErasure(
          `class C<T> extends B<T> implements I<T>, J { x = 1 }`,
          `class C    extends B                       { x = 1 }`,
        );
      });

      it("erases implements on its own line", () => {
        expectErasure(
          `class C\n  implements I {}`,
          `class C\n               {}`,
        );
      });

      it("does not erase implements as a property", () => {
        const input = `const o = { implements: 1 }; o.implements`;
        expectErasure(input, input);
      });

      it("finds the body after a class in the heritage clause", () => {
        expectErasure(
          `class A extends class B {} { readonly x = 1 }`,
          `class A extends class B {} {          x = 1 }`,
        );
      });
    });
  });
});
