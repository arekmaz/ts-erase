function isIdentChar(ch: string): boolean {
  return (
    (ch >= "a" && ch <= "z") ||
    (ch >= "A" && ch <= "Z") ||
    (ch >= "0" && ch <= "9") ||
    ch === "_" ||
    ch === "$"
  );
}

function isWhitespace(ch: string): boolean {
  return ch === " " || ch === "\t" || ch === "\r" || ch === "\n";
}

function blankRange(
  chars: Array<string>,
  start: number,
  end: number,
  semiPrefix: boolean,
): void {
  for (let i = start; i < end; i++) {
    if (chars[i] === "\n") {
      continue;
    }
    if (semiPrefix && i === start) {
      chars[i] = ";";
      semiPrefix = false;
      continue;
    }
    chars[i] = " ";
  }
}

function matchWord(source: string, pos: number, word: string): boolean {
  if (source.length < pos + word.length) {
    return false;
  }
  for (let i = 0; i < word.length; i++) {
    if (source[pos + i] !== word[i]) {
      return false;
    }
  }
  if (
    pos + word.length < source.length &&
    isIdentChar(source[pos + word.length])
  ) {
    return false;
  }
  return true;
}

function skipWhitespace(source: string, pos: number): number {
  while (pos < source.length && isWhitespace(source[pos])) {
    pos++;
  }
  return pos;
}

function skipString(source: string, pos: number): number {
  const quote = source[pos];
  pos++;
  while (pos < source.length) {
    if (source[pos] === "\\") {
      pos += 2;
      continue;
    }
    if (source[pos] === quote) {
      return pos + 1;
    }
    pos++;
  }
  return pos;
}

function skipTemplateInterpolation(source: string, pos: number): number {
  let depth = 1;
  while (pos < source.length && depth > 0) {
    if (source[pos] === "{") {
      depth++;
    } else if (source[pos] === "}") {
      depth--;
    } else if (source[pos] === "'" || source[pos] === '"') {
      pos = skipString(source, pos);
      continue;
    } else if (source[pos] === "`") {
      pos = skipTemplateLiteral(source, pos);
      continue;
    } else if (
      source[pos] === "/" &&
      pos + 1 < source.length &&
      source[pos + 1] === "/"
    ) {
      pos = skipLineComment(source, pos);
      continue;
    } else if (
      source[pos] === "/" &&
      pos + 1 < source.length &&
      source[pos + 1] === "*"
    ) {
      pos = skipBlockComment(source, pos);
      continue;
    }
    pos++;
  }
  return pos;
}

function skipTemplateLiteral(source: string, pos: number): number {
  pos++;
  while (pos < source.length) {
    if (source[pos] === "\\") {
      pos += 2;
      continue;
    }
    if (source[pos] === "`") {
      return pos + 1;
    }
    if (
      source[pos] === "$" &&
      pos + 1 < source.length &&
      source[pos + 1] === "{"
    ) {
      pos = skipTemplateInterpolation(source, pos + 2);
      continue;
    }
    pos++;
  }
  return pos;
}

function skipLineComment(source: string, pos: number): number {
  while (pos < source.length && source[pos] !== "\n") {
    pos++;
  }
  return pos;
}

function skipBlockComment(source: string, pos: number): number {
  pos += 2;
  while (pos < source.length) {
    if (
      source[pos] === "*" &&
      pos + 1 < source.length &&
      source[pos + 1] === "/"
    ) {
      return pos + 2;
    }
    pos++;
  }
  return pos;
}

function skipOpaqueAt(source: string, pos: number): number {
  if (pos >= source.length) {
    return pos;
  }
  const ch = source[pos];
  if (ch === "'" || ch === '"') {
    return skipString(source, pos);
  }
  if (ch === "`") {
    return -1;
  }
  if (ch === "/" && pos + 1 < source.length) {
    if (source[pos + 1] === "/") {
      return skipLineComment(source, pos);
    }
    if (source[pos + 1] === "*") {
      return skipBlockComment(source, pos);
    }
  }
  return -1;
}

function scanTypeExpression(
  source: string,
  pos: number,
  terminators: string,
): number {
  let depth = 0;
  while (pos < source.length) {
    const opaque = skipOpaqueAt(source, pos);
    if (opaque !== -1) {
      pos = opaque;
      continue;
    }
    const ch = source[pos];
    if (ch === "=" && pos + 1 < source.length && source[pos + 1] === ">") {
      pos += 2;
      continue;
    }
    if (depth === 0 && terminators.includes(ch)) {
      return pos;
    }
    if (ch === "<" || ch === "(" || ch === "[" || ch === "{") {
      depth++;
      pos++;
      continue;
    }
    if (ch === ">" || ch === ")" || ch === "]" || ch === "}") {
      depth--;
      if (depth < 0) {
        return pos;
      }
      pos++;
      continue;
    }
    pos++;
  }
  return pos;
}

function prevNonWhitespace(source: string, pos: number): string {
  let i = pos - 1;
  while (i >= 0 && isWhitespace(source[i])) {
    i--;
  }
  if (i < 0) {
    return "";
  }
  return source[i];
}


function isAfterDot(source: string, pos: number): boolean {
  return prevNonWhitespace(source, pos) === ".";
}

function findStatementEnd(source: string, pos: number): number {
  let depth = 0;
  let sawBrace = false;
  while (pos < source.length) {
    const opaque = skipOpaqueAt(source, pos);
    if (opaque !== -1) {
      pos = opaque;
      continue;
    }
    const ch = source[pos];
    if (ch === "{" || ch === "(" || ch === "[") {
      if (ch === "{") {
        sawBrace = true;
      }
      depth++;
      pos++;
      continue;
    }
    if (ch === "}" || ch === ")" || ch === "]") {
      if (depth === 0) {
        return pos + 1;
      }
      depth--;
      if (depth === 0 && ch === "}" && sawBrace) {
        return pos + 1;
      }
      pos++;
      continue;
    }
    if (depth === 0 && ch === ";") {
      return pos + 1;
    }
    if (depth === 0 && ch === "\n") {
      const prevCh = prevNonWhitespace(source, pos);
      if (prevCh === "=" || prevCh === "|" || prevCh === "&" || prevCh === ",") {
        pos++;
        continue;
      }
      const nextPos = skipWhitespace(source, pos + 1);
      if (nextPos < source.length && (source[nextPos] === "|" || source[nextPos] === "&")) {
        pos++;
        continue;
      }
      return pos;
    }
    pos++;
  }
  return pos;
}

function scanImportStatement(source: string, pos: number): number {
  let braceDepth = 0;
  while (pos < source.length) {
    if (source[pos] === "'" || source[pos] === '"') {
      pos = skipString(source, pos);
      if (pos < source.length && source[pos] === ";") {
        return pos + 1;
      }
      return pos;
    }
    if (source[pos] === "{") {
      braceDepth++;
      pos++;
      continue;
    }
    if (source[pos] === "}") {
      braceDepth--;
      pos++;
      continue;
    }
    if (source[pos] === ";") {
      return pos + 1;
    }
    if (source[pos] === "\n" && braceDepth === 0) {
      return pos;
    }
    pos++;
  }
  return pos;
}

function skipStringBackward(source: string, pos: number, quote: string): number {
  pos--;
  while (pos >= 0 && source[pos] !== quote) {
    if (source[pos] === "\\") {
      pos--;
    }
    pos--;
  }
  return pos;
}

function isTernaryColon(source: string, colonPos: number): boolean {
  let depth = 0;
  let i = colonPos - 1;
  while (i >= 0) {
    const ch = source[i];
    if (ch === "'" || ch === '"') {
      i = skipStringBackward(source, i, ch) - 1;
      continue;
    }
    if (ch === ")" || ch === "]") {
      depth++;
      i--;
      continue;
    }
    if (ch === "(" || ch === "[") {
      if (depth === 0) {
        return false;
      }
      depth--;
      i--;
      continue;
    }
    if (ch === "?" && depth === 0) {
      let j = i + 1;
      while (j < colonPos && isWhitespace(source[j])) {
        j++;
      }
      return j < colonPos;
    }
    if (depth === 0 && (ch === ";" || ch === "{" || ch === "}")) {
      return false;
    }
    i--;
  }
  return false;
}

function isDestructuringBrace(source: string, colonPos: number): boolean {
  let i = colonPos - 1;
  while (i >= 0 && isWhitespace(source[i])) {
    i--;
  }
  if (i < 0 || source[i] !== "}") {
    return false;
  }
  let depth = 1;
  i--;
  while (i >= 0 && depth > 0) {
    if (source[i] === "}") {
      depth++;
    }
    if (source[i] === "{") {
      depth--;
    }
    if (depth > 0) {
      i--;
    }
  }
  if (i <= 0) {
    return true;
  }
  i--;
  while (i >= 0 && isWhitespace(source[i])) {
    i--;
  }
  if (i < 0) {
    return true;
  }
  const ch = source[i];
  return ch === "(" || ch === ",";
}

function isInsideObjectLiteral(source: string, colonPos: number): boolean {
  let braces = 0;
  let parens = 0;
  let brackets = 0;
  let i = colonPos - 1;
  while (i >= 0) {
    const ch = source[i];
    if (ch === "}") {
      braces++;
    } else if (ch === "{") {
      if (braces === 0) {
        return true;
      }
      braces--;
    } else if (ch === ")") {
      parens++;
    } else if (ch === "(") {
      if (parens === 0) {
        return false;
      }
      parens--;
    } else if (ch === "]") {
      brackets++;
    } else if (ch === "[") {
      if (brackets === 0) {
        return false;
      }
      brackets--;
    } else if (ch === "'" || ch === '"') {
      i = skipStringBackward(source, i, ch);
    }
    i--;
  }
  return false;
}

function isVarDeclComma(source: string, colonPos: number): boolean {
  let i = colonPos - 1;
  while (i >= 0) {
    const ch = source[i];
    if (ch === ";" || ch === "{" || ch === "}") {
      return false;
    }
    if (isIdentChar(ch)) {
      const kwEnd = i + 1;
      while (i >= 0 && isIdentChar(source[i])) {
        i--;
      }
      const kw = source.slice(i + 1, kwEnd);
      if (kw === "let" || kw === "const" || kw === "var") {
        return true;
      }
    }
    i--;
  }
  return false;
}

function isTypeAnnotationContext(
  source: string,
  colonPos: number,
  parenDepth: number,
  braceDepth: number,
): boolean {
  const prev = prevNonWhitespace(source, colonPos);
  if (parenDepth > 0) {
    if (prev === "?" || prev === ")" || prev === "]") {
      if (isTernaryColon(source, colonPos)) {
        return false;
      }
      return true;
    }
    if (prev === "}") {
      return isDestructuringBrace(source, colonPos);
    }
    if (!isIdentChar(prev)) {
      return false;
    }
    if (isInsideObjectLiteral(source, colonPos)) {
      return false;
    }
    return true;
  }
  if (prev === ")" || prev === "]") {
    if (isTernaryColon(source, colonPos)) {
      return false;
    }
    return true;
  }
  if (!isIdentChar(prev)) {
    return false;
  }
  let i = colonPos - 1;
  while (i >= 0 && isWhitespace(source[i])) {
    i--;
  }
  const identEnd = i + 1;
  while (i >= 0 && isIdentChar(source[i])) {
    i--;
  }
  const identStart = i + 1;
  const identText = source.slice(identStart, identEnd);
  if (identText === "case" || identText === "default") {
    return false;
  }

  let bi = i;
  while (bi >= 0 && isWhitespace(source[bi])) {
    bi--;
  }
  const beforeIdent = bi >= 0 ? source[bi] : "";
  if (beforeIdent === "." || beforeIdent === ":" || beforeIdent === "?") {
    return false;
  }

  if (isIdentChar(beforeIdent)) {
    let kwEnd = bi + 1;
    let ki = bi;
    while (ki >= 0 && isIdentChar(source[ki])) {
      ki--;
    }
    const kw = source.slice(ki + 1, kwEnd);
    if (kw === "const" || kw === "let" || kw === "var") {
      return true;
    }
    if (
      kw === "function" ||
      kw === "class" ||
      kw === "return" ||
      kw === "case" ||
      kw === "default" ||
      kw === "as" ||
      kw === "satisfies"
    ) {
      return false;
    }
  }

  if (
    braceDepth > 0 &&
    (beforeIdent === "{" || beforeIdent === "," || beforeIdent === ";")
  ) {
    if (beforeIdent === ",") {
      if (isVarDeclComma(source, colonPos)) {
        return true;
      }
    }
    return false;
  }

  if (beforeIdent === "" && braceDepth === 0) {
    return false;
  }

  return true;
}

function getTypeAnnotationTerminators(
  source: string,
  colonPos: number,
  parenDepth: number,
): string {
  if (parenDepth > 0) {
    return ",)=";
  }
  const prev = prevNonWhitespace(source, colonPos);
  if (prev === ")") {
    return "{;=>";
  }
  return ",;=\n";
}

const closerFor: Record<string, string> = { "<": ">", "(": ")", "[": "]" };

function isAfterTypeOperator(source: string, pos: number): boolean {
  const prev = prevNonWhitespace(source, pos);
  return prev === "|" || prev === "&";
}

function findReturnTypeEnd(source: string, pos: number): number {
  let p = pos;
  while (p < source.length) {
    const opaque = skipOpaqueAt(source, p);
    if (opaque !== -1) {
      p = opaque;
      continue;
    }
    const ch = source[p];
    if (ch === "{" && (p === pos || isAfterTypeOperator(source, p))) {
      p = scanTypeExpression(source, p + 1, "") + 1;
      continue;
    }
    if (ch === "{") {
      return p;
    }
    if (ch === "=" && p + 1 < source.length && source[p + 1] === ">") {
      return p;
    }
    if (ch === ";" || ch === ")" || ch === "}") {
      return p;
    }
    if (ch === "<" || ch === "(" || ch === "[") {
      p = scanTypeExpression(source, p + 1, "");
      p = scanTypeExpression(source, p, closerFor[ch] || "");
      if (p < source.length) {
        p++;
      }
      continue;
    }
    p++;
  }
  return p;
}

function isInsideImportExportBraces(source: string, pos: number): boolean {
  let depth = 0;
  let i = pos - 1;
  while (i >= 0) {
    if (source[i] === "}") {
      depth++;
    }
    if (source[i] === "{") {
      if (depth === 0) {
        i--;
        while (i >= 0 && isWhitespace(source[i])) {
          i--;
        }
        if (i < 0) {
          return false;
        }
        let kwStart = i;
        while (kwStart > 0 && isIdentChar(source[kwStart - 1])) {
          kwStart--;
        }
        return matchWord(source, kwStart, "import") || matchWord(source, kwStart, "export");
      }
      depth--;
    }
    i--;
  }
  return false;
}

function findTypeAliasEnd(source: string, pos: number): number {
  let depth = 0;
  while (pos < source.length) {
    const opaque = skipOpaqueAt(source, pos);
    if (opaque !== -1) {
      pos = opaque;
      continue;
    }
    const ch = source[pos];
    if (ch === "=" && pos + 1 < source.length && source[pos + 1] === ">") {
      pos += 2;
      continue;
    }
    if (ch === "{" || ch === "(" || ch === "[" || ch === "<") {
      depth++;
      pos++;
      continue;
    }
    if (ch === "}" || ch === ")" || ch === "]" || ch === ">") {
      depth--;
      if (depth < 0) {
        return pos;
      }
      pos++;
      continue;
    }
    if (depth === 0 && ch === ";") {
      return pos + 1;
    }
    if (depth === 0 && ch === "\n") {
      const nextPos = skipWhitespace(source, pos + 1);
      if (nextPos < source.length && (source[nextPos] === "|" || source[nextPos] === "&")) {
        pos++;
        continue;
      }
      const prevCh = prevNonWhitespace(source, pos);
      if (prevCh === "=" || prevCh === "|" || prevCh === "&" || prevCh === ",") {
        pos++;
        continue;
      }
      return pos;
    }
    pos++;
  }
  return pos;
}

function isFunctionOverload(source: string, pos: number): boolean {
  let p = skipWhitespace(source, pos);
  const len = source.length;
  if (p < len && source[p] === "*") {
    p = skipWhitespace(source, p + 1);
  }
  while (p < len && isIdentChar(source[p])) {
    p++;
  }
  p = skipWhitespace(source, p);
  if (p >= len || source[p] !== "(") {
    return false;
  }
  let depth = 1;
  p++;
  while (p < len && depth > 0) {
    if (source[p] === "(") {
      depth++;
    }
    if (source[p] === ")") {
      depth--;
    }
    if (source[p] === "'" || source[p] === '"') {
      p = skipString(source, p);
      continue;
    }
    p++;
  }
  p = skipWhitespace(source, p);
  if (p < len && source[p] === ":") {
    p = findSignatureTerminator(source, skipLeadingObjectType(source, p + 1));
  }
  p = skipWhitespace(source, p);
  return p < len && source[p] === ";";
}

function isPostfixExpressionEnd(ch: string): boolean {
  return isIdentChar(ch) || ch === ")" || ch === "]" || ch === "}" || ch === '"' || ch === "'" || ch === "`";
}

function tryErasePostfixKeyword(
  chars: Array<string>,
  source: string,
  pos: number,
  keywordLen: number,
): number {
  const prev = prevNonWhitespace(source, pos);
  if (!isPostfixExpressionEnd(prev)) {
    return pos;
  }
  const start = pos;
  const afterKw = skipWhitespace(source, pos + keywordLen);
  const end = scanTypeExpression(source, afterKw, ",;:)]\n}");
  blankRange(chars, start, end, false);
  return end;
}

function tryEraseGenericArgs(
  chars: Array<string>,
  source: string,
  start: number,
  len: number,
): number {
  let pos = start + 1;
  let depth = 1;
  let looksLikeGeneric = true;
  while (pos < len && depth > 0) {
    const opaque = skipOpaqueAt(source, pos);
    if (opaque !== -1) {
      pos = opaque;
      continue;
    }
    if (source[pos] === "<") {
      depth++;
      pos++;
      continue;
    }
    if (source[pos] === ">") {
      depth--;
      pos++;
      continue;
    }
    if (
      source[pos] === "(" ||
      source[pos] === ")" ||
      source[pos] === ";" ||
      source[pos] === "{" ||
      source[pos] === "}"
    ) {
      looksLikeGeneric = false;
      break;
    }
    pos++;
  }
  if (!looksLikeGeneric || depth !== 0) {
    return start + 1;
  }
  const afterClose =
    source[pos] === "(" ||
    source[pos] === ")" ||
    source[pos] === ">" ||
    source[pos] === "," ||
    source[pos] === ";" ||
    source[pos] === "{" ||
    source[pos] === "=" ||
    source[pos] === "\n" ||
    isWhitespace(source[pos]) ||
    source[pos] === "[" ||
    source[pos] === "." ||
    source[pos] === "&" ||
    source[pos] === "|" ||
    pos >= len;
  if (afterClose) {
    blankRange(chars, start, pos, false);
    return pos;
  }
  return start + 1;
}

function eraseInlineTypeSpecifiers(
  chars: Array<string>,
  source: string,
  pos: number,
  len: number,
): number {
  while (pos < len && source[pos] !== "}") {
    const opaque = skipOpaqueAt(source, pos);
    if (opaque !== -1) {
      pos = opaque;
      continue;
    }
    if (matchWord(source, pos, "type")) {
      pos = eraseOneTypeSpecifier(chars, source, pos, len);
      continue;
    }
    pos++;
  }
  return pos;
}

function eraseOneTypeSpecifier(
  chars: Array<string>,
  source: string,
  typeStart: number,
  len: number,
): number {
  const afterKw = skipWhitespace(source, typeStart + 4);
  let identEnd = afterKw;
  while (identEnd < len && isIdentChar(source[identEnd])) {
    identEnd++;
  }
  if (identEnd === afterKw) {
    return typeStart + 1;
  }
  const afterIdent = skipWhitespace(source, identEnd);
  if (afterIdent < len && source[afterIdent] === ",") {
    blankRange(chars, typeStart, skipWhitespace(source, afterIdent + 1), false);
    return skipWhitespace(source, afterIdent + 1);
  }
  let lookBack = typeStart - 1;
  while (lookBack >= 0 && isWhitespace(source[lookBack])) {
    lookBack--;
  }
  if (lookBack >= 0 && source[lookBack] === ",") {
    blankRange(chars, lookBack, identEnd, false);
    return identEnd;
  }
  blankRange(chars, typeStart, identEnd, false);
  return identEnd;
}

type ClassBody = { braceDepth: number; parenDepth: number };

type ClassModifier = { word: string; start: number; end: number; next: number };

const classModifiers = new Set([
  "public",
  "private",
  "protected",
  "readonly",
  "abstract",
  "override",
  "declare",
  "static",
]);

const statementKeywords = new Set([
  "declare",
  "export",
  "function",
  "import",
  "interface",
  "type",
]);

function isWordStart(source: string, pos: number): boolean {
  return pos === 0 || !isIdentChar(source[pos - 1]);
}

function skipInlineTrivia(source: string, pos: number): number {
  while (pos < source.length) {
    if (source[pos] === " " || source[pos] === "\t") {
      pos++;
      continue;
    }
    if (source.startsWith("/*", pos)) {
      pos = skipBlockComment(source, pos);
      continue;
    }
    return pos;
  }
  return pos;
}

function isClassKeyword(source: string, pos: number): boolean {
  if (!isWordStart(source, pos) || isAfterDot(source, pos)) {
    return false;
  }
  const next = skipWhitespace(source, pos + 5);
  if (next >= source.length) {
    return false;
  }
  return (
    isIdentChar(source[next]) || source[next] === "{" || source[next] === "<"
  );
}

function findClassBodyStart(source: string, pos: number): number {
  let p = pos;
  while (p < source.length) {
    p = scanTypeExpression(source, p, "c{");
    if (source[p] !== "c") {
      return p;
    }
    if (matchWord(source, p, "class") && isClassKeyword(source, p)) {
      const nestedBody = findClassBodyStart(source, p + 5);
      p = scanTypeExpression(source, nestedBody + 1, "") + 1;
      continue;
    }
    p++;
  }
  return p;
}

function eraseClassHeaderGenerics(
  chars: Array<string>,
  source: string,
  pos: number,
  bodyStart: number,
): void {
  let p = scanTypeExpression(source, pos, "<{");
  while (p < bodyStart) {
    const isGeneric = source[p] === "<";
    const close = scanTypeExpression(source, p + 1, isGeneric ? ">" : "");
    if (close >= source.length) {
      return;
    }
    if (isGeneric) {
      blankRange(chars, p, close + 1, false);
    }
    p = scanTypeExpression(source, close + 1, "<{");
  }
}

function isAtClassBodyLevel(
  classBodies: Array<ClassBody>,
  templateStack: Array<number>,
  braceDepth: number,
  parenDepth: number,
): boolean {
  const current = classBodies.at(-1);
  return (
    current !== undefined &&
    current.braceDepth === braceDepth &&
    current.parenDepth === parenDepth &&
    templateStack.at(-1) !== braceDepth
  );
}

function prevCodeIndex(
  chars: Array<string>,
  commentStarts: Map<number, number>,
  pos: number,
): number {
  let i = pos - 1;
  while (i >= 0) {
    const commentStart = commentStarts.get(i + 1);
    if (commentStart !== undefined) {
      i = commentStart - 1;
      continue;
    }
    if (!isWhitespace(chars[i])) {
      return i;
    }
    i--;
  }
  return i;
}

function isClassMemberStart(
  chars: Array<string>,
  source: string,
  commentStarts: Map<number, number>,
  pos: number,
): boolean {
  const prev = prevCodeIndex(chars, commentStarts, pos);
  if (prev < 0) {
    return false;
  }
  if ("{;}".includes(chars[prev])) {
    return true;
  }
  return (
    isPostfixExpressionEnd(chars[prev]) &&
    source.slice(prev, pos).includes("\n")
  );
}

function canStartMemberName(source: string, pos: number): boolean {
  if (pos >= source.length) {
    return false;
  }
  return isIdentChar(source[pos]) || "#[*\"'".includes(source[pos]);
}

function readClassModifier(source: string, pos: number): ClassModifier | null {
  let end = pos;
  while (end < source.length && isIdentChar(source[end])) {
    end++;
  }
  const word = source.slice(pos, end);
  if (!classModifiers.has(word)) {
    return null;
  }
  const next = skipInlineTrivia(source, end);
  if (!canStartMemberName(source, next)) {
    return null;
  }
  return { word, start: pos, end, next };
}

function scanClassModifiers(source: string, pos: number): Array<ClassModifier> {
  const modifier = readClassModifier(source, pos);
  if (modifier === null) {
    return [];
  }
  return [modifier, ...scanClassModifiers(source, modifier.next)];
}

function isIndexSignature(source: string, pos: number): boolean {
  if (source[pos] !== "[") {
    return false;
  }
  const nameStart = skipWhitespace(source, pos + 1);
  let nameEnd = nameStart;
  while (nameEnd < source.length && isIdentChar(source[nameEnd])) {
    nameEnd++;
  }
  return (
    nameEnd > nameStart && source[skipWhitespace(source, nameEnd)] === ":"
  );
}

function scanMemberType(
  source: string,
  pos: number,
  terminators: string,
): number {
  const end = scanTypeExpression(source, pos, terminators);
  if (source[end] !== "\n") {
    return end;
  }
  const prevCh = prevNonWhitespace(source, end);
  const nextCh = source[skipWhitespace(source, end + 1)];
  if (":|&=,".includes(prevCh) || nextCh === "|" || nextCh === "&") {
    return scanMemberType(source, end + 1, terminators);
  }
  return end;
}

function findClassMemberEnd(source: string, pos: number): number {
  const end = scanMemberType(source, pos, ";\n");
  return source[end] === ";" ? end + 1 : end;
}

function skipMemberName(source: string, pos: number): number {
  if (source[pos] === "'" || source[pos] === '"') {
    return skipString(source, pos);
  }
  if (source[pos] === "[") {
    return scanTypeExpression(source, pos + 1, "]") + 1;
  }
  let end = source[pos] === "#" ? pos + 1 : pos;
  while (end < source.length && isIdentChar(source[end])) {
    end++;
  }
  return end;
}

function skipLeadingObjectType(source: string, pos: number): number {
  const start = skipWhitespace(source, pos);
  if (source[start] !== "{") {
    return start;
  }
  return scanTypeExpression(source, start + 1, "") + 1;
}

function findSignatureTerminator(source: string, pos: number): number {
  const end = scanMemberType(source, pos, ";{\n");
  if (source[end] === "{" && isAfterTypeOperator(source, end)) {
    return findSignatureTerminator(
      source,
      scanTypeExpression(source, end + 1, "") + 1,
    );
  }
  return end;
}

function findMethodParamsStart(source: string, pos: number): number {
  const afterName = skipInlineTrivia(source, skipMemberName(source, pos));
  const afterMarker = source[afterName] === "?" ? afterName + 1 : afterName;
  if (source[afterMarker] !== "<") {
    return skipWhitespace(source, afterMarker);
  }
  return skipWhitespace(
    source,
    scanTypeExpression(source, afterMarker + 1, ">") + 1,
  );
}

function isMethodSignature(source: string, pos: number): boolean {
  const open = findMethodParamsStart(source, pos);
  if (source[open] !== "(") {
    return false;
  }
  const close = scanTypeExpression(source, open + 1, ")");
  if (source[close] !== ")") {
    return false;
  }
  const afterParams = skipWhitespace(source, close + 1);
  if (source[afterParams] !== ":") {
    return source[afterParams] !== "{";
  }
  const typeStart = skipLeadingObjectType(source, afterParams + 1);
  const typeEnd = findSignatureTerminator(source, typeStart);
  return source[skipWhitespace(source, typeEnd)] !== "{";
}

function isBodilessMember(
  source: string,
  modifiers: Array<ClassModifier>,
  memberStart: number,
): boolean {
  return (
    isIndexSignature(source, memberStart) ||
    isMethodSignature(source, memberStart) ||
    modifiers.some(function isAmbient(modifier) {
      return modifier.word === "abstract" || modifier.word === "declare";
    })
  );
}

function eraseMemberTypeAnnotation(
  chars: Array<string>,
  source: string,
  pos: number,
): number {
  if (source[pos] === "[") {
    return pos;
  }
  const nameEnd = skipMemberName(source, pos);
  const afterName = skipInlineTrivia(source, nameEnd);
  const isMarked = source[afterName] === "?" || source[afterName] === "!";
  const afterMarker = isMarked ? afterName + 1 : afterName;
  const colon = skipInlineTrivia(source, afterMarker);
  if (source[colon] === ":") {
    const typeStart = skipWhitespace(source, colon + 1);
    const end = scanMemberType(source, typeStart, ",;=\n");
    blankRange(chars, afterName, end, false);
    return end;
  }
  if (isMarked) {
    blankRange(chars, afterName, afterMarker, false);
    return afterMarker;
  }
  return statementKeywords.has(source.slice(pos, nameEnd)) ? nameEnd : pos;
}

function eraseClassMember(
  chars: Array<string>,
  source: string,
  pos: number,
): number {
  const modifiers = scanClassModifiers(source, pos);
  const memberStart = modifiers.at(-1)?.next ?? pos;
  if (isBodilessMember(source, modifiers, memberStart)) {
    const end = findClassMemberEnd(source, memberStart);
    blankRange(chars, pos, end, true);
    return end;
  }
  const continuesPreviousLine =
    source[memberStart] === "[" || source[memberStart] === "*";
  for (const modifier of modifiers) {
    if (modifier.word !== "static") {
      const semiPrefix = continuesPreviousLine && modifier.start === pos;
      blankRange(chars, modifier.start, modifier.end, semiPrefix);
    }
  }
  return eraseMemberTypeAnnotation(chars, source, memberStart);
}

function enterTemplate(
  source: string,
  pos: number,
  braceDepth: number,
  templateStack: Array<number>,
): number {
  while (pos < source.length) {
    if (source[pos] === "\\") {
      pos += 2;
      continue;
    }
    if (source[pos] === "`") {
      return pos + 1;
    }
    if (
      source[pos] === "$" &&
      pos + 1 < source.length &&
      source[pos + 1] === "{"
    ) {
      templateStack.push(braceDepth);
      return pos + 2;
    }
    pos++;
  }
  return pos;
}

export function eraseTsTypes(source: string): string {
  const chars = source.split("");
  const len = source.length;
  let pos = 0;
  let parenDepth = 0;
  let braceDepth = 0;
  const templateStack: Array<number> = [];
  const classBodyStarts = new Set<number>();
  const classBodies: Array<ClassBody> = [];
  const commentStarts = new Map<number, number>();

  while (pos < len) {
    if (
      canStartMemberName(source, pos) &&
      isAtClassBodyLevel(classBodies, templateStack, braceDepth, parenDepth) &&
      isClassMemberStart(chars, source, commentStarts, pos)
    ) {
      const erased = eraseClassMember(chars, source, pos);
      if (erased !== pos) {
        pos = erased;
        continue;
      }
    }

    const opaque = skipOpaqueAt(source, pos);
    if (opaque !== -1) {
      if (source[pos] === "/") {
        commentStarts.set(opaque, pos);
      }
      pos = opaque;
      continue;
    }

    const ch = source[pos];

    if (ch === "`") {
      pos = enterTemplate(source, pos + 1, braceDepth, templateStack);
      continue;
    }

    if (ch === "(") {
      parenDepth++;
      pos++;
      continue;
    }
    if (ch === ")") {
      parenDepth--;
      pos++;
      continue;
    }
    if (ch === "{") {
      braceDepth++;
      if (classBodyStarts.has(pos)) {
        classBodies.push({ braceDepth, parenDepth });
      }
      pos++;
      continue;
    }
    if (ch === "}") {
      if (
        templateStack.length > 0 &&
        braceDepth === templateStack[templateStack.length - 1]
      ) {
        templateStack.pop();
        pos = enterTemplate(source, pos + 1, braceDepth, templateStack);
        continue;
      }
      if (classBodies.at(-1)?.braceDepth === braceDepth) {
        classBodies.pop();
      }
      braceDepth--;
      pos++;
      continue;
    }

    if (
      ch === ":" &&
      isTypeAnnotationContext(source, pos, parenDepth, braceDepth)
    ) {
      const terminators = getTypeAnnotationTerminators(source, pos, parenDepth);
      let start = pos;
      if (parenDepth > 0 && start > 0 && source[start - 1] === "?") {
        start--;
      }
      pos++;
      pos = skipWhitespace(source, pos);
      if (terminators.includes("{")) {
        const end = findReturnTypeEnd(source, pos);
        blankRange(chars, start, end, false);
        pos = end;
      } else {
        const end = scanTypeExpression(source, pos, terminators);
        blankRange(chars, start, end, false);
        pos = end;
      }
      continue;
    }

    if (matchWord(source, pos, "function") && !isAfterDot(source, pos) && isFunctionOverload(source, pos + 8)) {
      const start = pos;
      const end = findStatementEnd(source, pos + 8);
      blankRange(chars, start, end, true);
      pos = end;
      continue;
    }

    if (matchWord(source, pos, "interface") && !isAfterDot(source, pos)) {
      const start = pos;
      pos += 9;
      const end = findStatementEnd(source, pos);
      blankRange(chars, start, end, true);
      pos = end;
      continue;
    }

    if (matchWord(source, pos, "type") && !isAfterDot(source, pos)) {
      const start = pos;
      pos += 4;
      const afterType = skipWhitespace(source, pos);
      if (afterType < len && isIdentChar(source[afterType])) {
        let scan = afterType;
        while (scan < len && isIdentChar(source[scan])) {
          scan++;
        }
        const afterIdent = skipWhitespace(source, scan);
        if (
          afterIdent < len &&
          (source[afterIdent] === "=" || source[afterIdent] === "<")
        ) {
          const end = findTypeAliasEnd(source, afterIdent);
          blankRange(chars, start, end, true);
          pos = end;
          continue;
        }
      }
      pos = start + 4;
      continue;
    }

    if (matchWord(source, pos, "import")) {
      const importStart = pos;
      pos += 6;
      const afterImport = skipWhitespace(source, pos);
      if (matchWord(source, afterImport, "type")) {
        const end = scanImportStatement(source, afterImport + 4);
        blankRange(chars, importStart, end, true);
        pos = end;
        continue;
      }
      pos = afterImport;
      if (pos < len && source[pos] === "{") {
        pos = eraseInlineTypeSpecifiers(chars, source, pos + 1, len);
        if (pos < len) {
          pos++;
        }
        pos = scanImportStatement(source, pos);
        continue;
      }
      pos = scanImportStatement(source, importStart + 6);
      continue;
    }

    if (matchWord(source, pos, "export")) {
      const exportStart = pos;
      pos += 6;
      const afterExport = skipWhitespace(source, pos);
      if (matchWord(source, afterExport, "type")) {
        const afterType = skipWhitespace(source, afterExport + 4);
        if (
          afterType < len &&
          (source[afterType] === "{" || isIdentChar(source[afterType]))
        ) {
          const peek = afterType;
          if (source[peek] === "{") {
            const end = scanImportStatement(source, peek);
            blankRange(chars, exportStart, end, true);
            pos = end;
            continue;
          }
          let scan = peek;
          while (scan < len && isIdentChar(source[scan])) {
            scan++;
          }
          let afterIdent = skipWhitespace(source, scan);
          if (afterIdent < len && source[afterIdent] === "<") {
            afterIdent = scanTypeExpression(source, afterIdent + 1, ">");
            if (afterIdent < len) {
              afterIdent++;
            }
            afterIdent = skipWhitespace(source, afterIdent);
          }
          if (afterIdent < len && source[afterIdent] === "=") {
            const end = findTypeAliasEnd(source, afterIdent);
            blankRange(chars, exportStart, end, true);
            pos = end;
            continue;
          }
        }
      }
      if (matchWord(source, afterExport, "function") && isFunctionOverload(source, afterExport + 8)) {
        const end = findStatementEnd(source, afterExport + 8);
        blankRange(chars, exportStart, end, true);
        pos = end;
        continue;
      }
      if (matchWord(source, afterExport, "interface") && !isAfterDot(source, afterExport)) {
        const end = findStatementEnd(source, afterExport + 9);
        blankRange(chars, exportStart, end, true);
        pos = end;
        continue;
      }
      if (matchWord(source, afterExport, "declare") && !isAfterDot(source, afterExport)) {
        const end = findStatementEnd(source, afterExport + 7);
        blankRange(chars, exportStart, end, true);
        pos = end;
        continue;
      }
      pos = afterExport;
      continue;
    }

    if (matchWord(source, pos, "class") && isClassKeyword(source, pos)) {
      const bodyStart = findClassBodyStart(source, pos + 5);
      classBodyStarts.add(bodyStart);
      eraseClassHeaderGenerics(chars, source, pos + 5, bodyStart);
      pos += 5;
      continue;
    }

    if (
      matchWord(source, pos, "implements") &&
      isWordStart(source, pos) &&
      !isAfterDot(source, pos) &&
      isIdentChar(source[skipInlineTrivia(source, pos + 10)] ?? "")
    ) {
      const end = scanTypeExpression(source, pos + 10, "{");
      blankRange(chars, pos, end, false);
      pos = end;
      continue;
    }

    if (
      matchWord(source, pos, "abstract") &&
      isWordStart(source, pos) &&
      matchWord(source, skipInlineTrivia(source, pos + 8), "class")
    ) {
      blankRange(chars, pos, pos + 8, false);
      pos += 8;
      continue;
    }

    if (matchWord(source, pos, "declare") && !isAfterDot(source, pos)) {
      const start = pos;
      const end = findStatementEnd(source, pos + 7);
      blankRange(chars, start, end, true);
      pos = end;
      continue;
    }

    if (
      matchWord(source, pos, "as") &&
      !isAfterDot(source, pos) &&
      !isInsideImportExportBraces(source, pos)
    ) {
      const erased = tryErasePostfixKeyword(chars, source, pos, 2);
      if (erased !== pos) {
        pos = erased;
        continue;
      }
    }

    if (matchWord(source, pos, "satisfies") && !isAfterDot(source, pos)) {
      const erased = tryErasePostfixKeyword(chars, source, pos, 9);
      if (erased !== pos) {
        pos = erased;
        continue;
      }
    }

    if (ch === "!" && pos > 0) {
      const prev = prevNonWhitespace(source, pos);
      if (isIdentChar(prev) || prev === ")" || prev === "]") {
        const next = pos + 1 < len ? source[pos + 1] : "";
        if (next !== "=" && next !== "!") {
          chars[pos] = " ";
          pos++;
          continue;
        }
      }
    }

    if (ch === "<" && pos > 0) {
      const prev = prevNonWhitespace(source, pos);
      if (isIdentChar(prev) || prev === ")") {
        pos = tryEraseGenericArgs(chars, source, pos, len);
        continue;
      }
    }

    pos++;
  }

  return chars.join("");
}
