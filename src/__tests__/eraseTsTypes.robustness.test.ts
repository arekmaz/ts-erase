import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { eraseTsTypes } from "../eraseTsTypes.ts";

const fixturesDir = new URL("../../benchmark/fixtures", import.meta.url).pathname;
const fixtures = readdirSync(fixturesDir).map(function loadFixture(name) {
  return { name, source: readFileSync(join(fixturesDir, name), "utf8") };
});

const multiLineSources = [
  `class C {\n  readonly a: string\n  b?: number\n  c = 1\n}`,
  `class C {\n  readonly\n  a = 1\n}`,
  `class C {\n  a = 1\n  readonly [b] = 2\n}`,
  `abstract class C {\n  abstract a(): void\n  b() {}\n}`,
  `class C {\n  a(b: string): string\n  a(b: number): number\n  a(b: unknown) { return b }\n}`,
  `function f(a: A): B\nfunction f(a) { return a }`,
  `type A =\n  | B\n  | C\nconst a = 1`,
  `type A<T> = T extends B\n  ? C\n  : D\nconst a = 1`,
  `const a = b as\n  | C\n  | D\ne()`,
  `const a = (\n  b: C\n): D<\n  E\n> => b`,
  `const a = b\n  ? c\n  : d`,
  `// a comment.\ntype A = B\nconst a = 1`,
  `a\n!b`,
  `const a = /x/\nconst b: C = 1`,
  `interface A {\n  b: string\n}\nconst a = 1`,
];

const incompleteSources = [
  `const a = "abc\\`,
  `const a = 'abc\\`,
  "const a = `abc\\",
  "const a = `${b",
  `const a = /abc\\`,
  `/* unterminated`,
  `class C<T`,
  `class C extends (`,
  `class C { readonly`,
  `class C { readonly a: `,
  `class C { abstract a(`,
  `abstract class C { abstract a(): {`,
  `function f(a: string`,
  `function f(): {`,
  `type A = {`,
  `interface A<T extends {`,
  `namespace A {`,
  `import { type`,
  `switch (a) { case`,
  `const a = <T`,
  `f<{ a: "`,
];

function assertSameLength(source: string): void {
  assert.strictEqual(eraseTsTypes(source).length, source.length, source);
}

function withoutWhitespace(code: string): string {
  return code.replace(/\s/g, "");
}

function toCrlf(code: string): string {
  return code.replaceAll("\n", "\r\n");
}

function assertCrlfMatchesLf(source: string): void {
  assert.strictEqual(
    withoutWhitespace(eraseTsTypes(toCrlf(source))),
    withoutWhitespace(eraseTsTypes(source)),
  );
}

describe("incomplete sources", () => {
  for (const source of incompleteSources) {
    it(`keeps the length of ${JSON.stringify(source)}`, () => {
      assertSameLength(source);
    });
  }

  it("keeps the length of every prefix of each incomplete source", () => {
    for (const source of incompleteSources) {
      for (let end = 0; end <= source.length; end++) {
        assertSameLength(source.slice(0, end));
      }
    }
  });

  for (const { name, source } of fixtures) {
    it(`keeps the length of truncated ${name}`, () => {
      for (let end = 0; end <= source.length; end += 7) {
        assertSameLength(source.slice(0, end));
      }
    });
  }
});

describe("CRLF line endings", () => {
  for (const source of multiLineSources) {
    it(`matches LF output for ${JSON.stringify(source)}`, () => {
      assertCrlfMatchesLf(source);
    });
  }

  for (const { name, source } of fixtures) {
    it(`matches LF output for ${name}`, () => {
      assertCrlfMatchesLf(source);
    });
  }
});

describe("very long inputs", () => {
  const count = 20000;

  it("erases a type alias with a very long union", () => {
    const source = `type A =\n${`  | "a"\n`.repeat(count)}const b = 1`;
    assert.strictEqual(eraseTsTypes(source).trim().slice(1).trim(), "const b = 1");
  });

  it("erases a class field with a very long union", () => {
    const source = `class C {\n  a:\n${`    | "a"\n`.repeat(count)}}`;
    assert.strictEqual(withoutWhitespace(eraseTsTypes(source)), "classC{a}");
  });

  it("erases a type alias before a very long comment block", () => {
    const source = `type A = B\n${`// a\n`.repeat(count)}const b = 1`;
    assert.ok(eraseTsTypes(source).endsWith("const b = 1"));
    assert.ok(!eraseTsTypes(source).includes("type A"));
  });

  it("handles a ternary after a very long comment block", () => {
    const source = `const a = b\n${`// c\n`.repeat(count)}const d = (e): F => e`;
    assert.ok(!eraseTsTypes(source).includes(": F"));
  });
});

describe("non-ASCII identifiers", () => {
  const cases: Array<[string, string]> = [
    [`const é: string = "a"`, `const é         = "a"`],
    [`const naïve: string = "a"`, `const naïve         = "a"`],
    [`const 名前: string = "a"`, `const 名前         = "a"`],
    [`function f(é: string) {}`, `function f(é        ) {}`],
    [`class C { readonly é = 1 }`, `class C {          é = 1 }`],
    [`class C { é: string = "a" }`, `class C { é         = "a" }`],
    [`é as string`, `é          `],
    [`é!.a`, `é .a`],
    [`é<string>(a)`, `é        (a)`],
  ];

  for (const [input, expected] of cases) {
    it(`erases types in ${input}`, () => {
      assert.strictEqual(eraseTsTypes(input), expected);
    });
  }

  it("preserves an emoji in a string before a cast", () => {
    assert.strictEqual(eraseTsTypes(`a("😀" as string)`), `a("😀"          )`);
  });

  it("keeps the keyword check on a name ending in a non-ASCII letter", () => {
    const input = `const éas = 1; éas.b`;
    assert.strictEqual(eraseTsTypes(input), input);
  });
});
