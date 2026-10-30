# ts-erase

A utility to erase typescript types, single file, no dependencies.

Allows you to serve TypeScript directly to the browser. No bundler, no build step, no transpiler — just erase the types and ship it.
Provided as a bunch of single-file-dependencies composed together.
No external dependencies - only Node.js version that can run typescript natively is required.

## Alternatives and tradeoffs

ts-erase is not the fastest or the most robust option. Its advantage is that it is one dependency-free file you can read and keep.

| Tool                           | How it works                          | Install size                     | Speed compared to ts-erase                                | Syntax it can't erase                                    |
| ------------------------------ | ------------------------------------- | -------------------------------- | --------------------------------------------------------- | -------------------------------------------------------- |
| ts-erase                       | Hand-written scanner, no parser       | One 53 KB file, no dependencies  | n/a                                                       | Left in place, fails as a syntax error at runtime        |
| `stripTypeScriptTypes` in Node | Built on amaro, still experimental    | None, ships with Node            | 2-3x faster on most code, slower on type-heavy files      | Throws a clear error, `transform` mode supports `enum`   |
| [amaro](https://github.com/nodejs/amaro) | SWC compiled to WebAssembly | 3.7 MB                           | 2-3x faster on most code, slower on type-heavy files      | Throws a clear error, `transform` mode supports `enum`   |
| [ts-blank-space](https://github.com/bloomberg/ts-blank-space) | Uses the TypeScript parser | 76 KB plus TypeScript at 24 MB | About 2x faster on most code, slower on type-heavy files | Calls your `onError` callback, otherwise left in place silently |
| tsc, esbuild, bundlers         | Full compilers                        | Varies                           | Not measured                                              | None, but they need a build step                         |

Speed figures come from the [benchmarks](#benchmarks) below.

**Use ts-erase when** you want no dependencies, a small amount of code you can read and change, and a dev server or browser setup with no build step.

**Use `stripTypeScriptTypes` when** you are on Node and don't mind an experimental API. It is faster on most code, needs no install, and uses a real parser.

**Use a compiler when** you need `enum`, parameter properties, runtime namespaces, or minification.

What you give up with ts-erase:

- **No parser.** It decides what is a type with heuristics, so unusual code can be misread. On 2175 real-world files its output matched `stripTypeScriptTypes` on 2169, and the other 6 differ only in comments. A misread can still produce valid JavaScript that behaves differently.
- **Later failures.** Syntax that can't be erased, such as `constructor(private x: string)` or `enum`, is left in the output, so you see a syntax error at runtime rather than a clear error from the tool.
- **Slower on most code.** It is only ahead on files that are mostly types.

## Philosophy

The aim is to stay simple, dependency-less and supported for as long as possible - hence Browser + Node.js.

The TypeScript you write is already valid JavaScript with some annotations sprinkled in. The conventional approach — transpiling, bundling, generating source maps — adds a massive toolchain between your code and the browser, all to remove what amounts to whitespace-level decoration.

ts-serve takes the opposite stance: types are metadata, not code. Strip them out, preserve every byte position and every newline, and serve the result as plain JavaScript. The output is character-for-character identical to the input except that type annotations become spaces, with two small exceptions: an erased statement can start with `;` so the surrounding code still parses, and when a multi-line return type sits between `)` and `=>`, the `)` moves down to the line with the `=>`, because JavaScript doesn't allow a line break before `=>`. No AST, no source maps needed, no configuration. Your browser's devtools point at the right lines because the lines never moved, the code stays inspectable and discoverable.

This is not a compiler. It is an eraser.

## Demo

Enter the demo folder:

```
cd apps/todos
```

For this demo I chose to write the backend API part using [effect](https://effect.website) - so `npm install is needed`.
But a backend written using only Node native API's wouldn't need to install anything.

Run it:

```
npm start
```

Open http://localhost:3000 — TypeScript served directly to the browser, types erased on the fly, no build step.

The browser dependencies are loaded from URL's - I chose to use solid-js with tagged string templates - without a need for a build step.

## API

### `eraseTsTypes(source: string): string`

The core primitive. Takes TypeScript source code and returns JavaScript with all type-level syntax replaced by spaces. Output length always equals input length. Newlines are preserved.

Handles: type annotations, interfaces, type aliases, generics, `as` / `satisfies` casts, `import type`, `export type`, `declare` statements, non-null assertions, class modifiers (`public`, `private`, `protected`, `readonly`, `override`, `abstract`, `declare`), class field annotations, `implements` clauses, method overload signatures, `this` parameters, type-only namespaces.

Constructor parameter properties (`constructor(private x: string)`) need generated code, so they are left in place and fail as a syntax error.

```ts
import { eraseTsTypes } from "ts-serve";

const js = eraseTsTypes(`const x: number = 1`);
//    js === `const x         = 1`
```

### `createTsServeHandler(options): WebMiddleware`

Returns a request handler that serves `.ts` files from a root directory with types erased. Non-`.ts` requests pass through (returns `null`). Path traversal is rejected with 403.

```ts
type TsServeOptions = {
  root: string;
  cache?: TsServeCache;
};

type TsServeCache = {
  get(key: string): { source: string; erased: string } | undefined;
  set(key: string, value: { source: string; erased: string }): void;
};
```

The optional `cache` avoids re-parsing unchanged files. Bring your own `Map` or LRU.

### `createStaticHandler(root: string): WebMiddleware`

Returns a request handler that serves static files from a root directory. Requests to `/` serve `index.html`. Unknown extensions get `application/octet-stream`. Missing files pass through (returns `null`). Path traversal is rejected with 403.

### `composeWebHandlers(...handlers): (request: Request) => Promise<Response>`

Chains middleware handlers. Each handler returns `Response | null` — first non-null response wins. Falls back to 404.

```ts
const app = composeWebHandlers(
  createTsServeHandler({ root: "./src" }),
  myStaticFileHandler,
);
```

### `nodeFromWebHandler(handler): (req, res) => void`

Adapts a Web Standard `Request → Response` handler to Node.js `http.createServer`. Handles header conversion, streaming request bodies, and response piping.

```ts
import { createServer } from "node:http";

createServer(nodeFromWebHandler(app)).listen(3000);
```

## Scripts

`npm install` is required in `apps/todos` for the dev scripts to work.

```
npm test        # run tests (vitest)
npm run typecheck  # type-check without emitting
npm run todos   # start the example app
```

## What gets erased

| TypeScript                        | Output                            |
| --------------------------------- | --------------------------------- |
| `const x: number = 1`             | `const x         = 1`             |
| `interface Foo { bar: string }`   | `;                              ` |
| `type ID = string`                | `;                `               |
| `import type { X } from "./x.ts"` | `;                              ` |
| `value as string`                 | `value          `                 |
| `obj!.prop`                       | `obj .prop`                       |
| `fn<string>(x)`                   | `fn        (x)`                   |
| `static readonly x = 1`           | `static          x = 1`           |
| `abstract class A {}`             | `         class A {}`             |
| `abstract foo(): void;`           | `;                    `           |

Every output is exactly the same length as the input. Every newline stays in place.

# Benchmarks:

`npm run benchmark`

On Mac M1 Air, Node.js 24.9.0:

```
Warmup: 500 iterations, Bench: 5000 iterations

--- annotation-heavy.ts (4323 bytes) ---
  eraseTsTypes        : 0.3906ms/op (2,560 ops/s)
  amaro               : 0.1642ms/op (6,088 ops/s)
  ts-blank-space      : 0.2086ms/op (4,793 ops/s)
  stripTypeScriptTypes: 0.1783ms/op (5,609 ops/s)
  eraseTsTypes vs amaro:                0.42x slower
  eraseTsTypes vs ts-blank-space:       0.53x slower
  eraseTsTypes vs stripTypeScriptTypes: 0.46x slower

--- mixed.ts (6120 bytes) ---
  eraseTsTypes        : 0.5503ms/op (1,817 ops/s)
  amaro               : 0.1910ms/op (5,236 ops/s)
  ts-blank-space      : 0.2780ms/op (3,597 ops/s)
  stripTypeScriptTypes: 0.2049ms/op (4,880 ops/s)
  eraseTsTypes vs amaro:                0.35x slower
  eraseTsTypes vs ts-blank-space:       0.51x slower
  eraseTsTypes vs stripTypeScriptTypes: 0.37x slower

--- plain-js.ts (2553 bytes) ---
  eraseTsTypes        : 0.2741ms/op (3,648 ops/s)
  amaro               : 0.0860ms/op (11,631 ops/s)
  ts-blank-space      : 0.1241ms/op (8,056 ops/s)
  stripTypeScriptTypes: 0.0908ms/op (11,010 ops/s)
  eraseTsTypes vs amaro:                0.31x slower
  eraseTsTypes vs ts-blank-space:       0.45x slower
  eraseTsTypes vs stripTypeScriptTypes: 0.33x slower

--- type-heavy.ts (3816 bytes) ---
  eraseTsTypes        : 0.0898ms/op (11,132 ops/s)
  amaro               : 0.1319ms/op (7,581 ops/s)
  ts-blank-space      : 0.1528ms/op (6,545 ops/s)
  stripTypeScriptTypes: 0.1412ms/op (7,081 ops/s)
  eraseTsTypes vs amaro:                1.47x faster
  eraseTsTypes vs ts-blank-space:       1.70x faster
  eraseTsTypes vs stripTypeScriptTypes: 1.57x faster
```
