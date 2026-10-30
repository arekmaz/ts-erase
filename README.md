# ts-erase

A utility to erase typescript types, single file, no dependencies.

Allows you to serve TypeScript directly to the browser. No bundler, no build step, no transpiler — just erase the types and ship it.
Provided as a bunch of single-file-dependencies composed together.
No external dependencies - only Node.js version that can run typescript natively is required.

## Philosophy

The aim is to stay simple, dependency-less and supported for as long as possible - hence Browser + Node.js.

The TypeScript you write is already valid JavaScript with some annotations sprinkled in. The conventional approach — transpiling, bundling, generating source maps — adds a massive toolchain between your code and the browser, all to remove what amounts to whitespace-level decoration.

ts-serve takes the opposite stance: types are metadata, not code. Strip them out, preserve every byte position and every newline, and serve the result as plain JavaScript. The output is character-for-character identical to the input except that type annotations become spaces. No AST, no source maps needed, no configuration. Your browser's devtools point at the right lines because the lines never moved, the code stays inspectable and discoverable.

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

On Mac M1 Air:

```
Warmup: 500 iterations, Bench: 5000 iterations

--- annotation-heavy.ts (4323 bytes) ---
  eraseTsTypes  : 0.2159ms/op (4,632 ops/s)
  amaro         : 0.1621ms/op (6,168 ops/s)
  ts-blank-space: 0.2101ms/op (4,759 ops/s)
  eraseTsTypes vs amaro:          0.75x slower
  eraseTsTypes vs ts-blank-space: 0.97x slower

--- mixed.ts (6120 bytes) ---
  eraseTsTypes  : 0.3020ms/op (3,311 ops/s)
  amaro         : 0.1796ms/op (5,567 ops/s)
  ts-blank-space: 0.2772ms/op (3,608 ops/s)
  eraseTsTypes vs amaro:          0.59x slower
  eraseTsTypes vs ts-blank-space: 0.92x slower

--- plain-js.ts (2553 bytes) ---
  eraseTsTypes  : 0.1490ms/op (6,713 ops/s)
  amaro         : 0.0862ms/op (11,595 ops/s)
  ts-blank-space: 0.1254ms/op (7,976 ops/s)
  eraseTsTypes vs amaro:          0.58x slower
  eraseTsTypes vs ts-blank-space: 0.84x slower

--- type-heavy.ts (3816 bytes) ---
  eraseTsTypes  : 0.0868ms/op (11,527 ops/s)
  amaro         : 0.1321ms/op (7,569 ops/s)
  ts-blank-space: 0.1581ms/op (6,324 ops/s)
  eraseTsTypes vs amaro:          1.52x faster
  eraseTsTypes vs ts-blank-space: 1.82x faster
```
