import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { join } from "node:path";
import { eraseTsTypes } from "../eraseTsTypes.ts";

const root = new URL("../../", import.meta.url).pathname;
const directories = ["src", "apps", "benchmark/fixtures"];

function isTypeScriptSource(path: string): boolean {
  return path.endsWith(".ts") && !path.endsWith(".d.ts");
}

function listTypeScriptFiles(directory: string): Array<string> {
  return readdirSync(directory, { withFileTypes: true, recursive: true })
    .filter(function isSourceFile(entry) {
      return entry.isFile() && !entry.parentPath.includes("node_modules");
    })
    .map(function toPath(entry) {
      return join(entry.parentPath, entry.name);
    })
    .filter(isTypeScriptSource);
}

function normalize(code: string): string {
  return code.replace(/[\s;]/g, "").replace(/,+}/g, "}");
}

describe("parity with node's type stripper", () => {
  const files = directories.flatMap(function listFiles(directory) {
    return listTypeScriptFiles(join(root, directory));
  });

  for (const file of files) {
    it(file.slice(root.length), () => {
      const source = readFileSync(file, "utf8");
      const erased = eraseTsTypes(source);
      assert.strictEqual(erased.length, source.length);
      assert.strictEqual(
        normalize(erased),
        normalize(stripTypeScriptTypes(source)),
      );
    });
  }
});
