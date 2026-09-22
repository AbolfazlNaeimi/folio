/**
 * A tiny, dependency-free parser for the specific subset of YAML that
 * Decap CMS produces for this project's front matter fields: strings,
 * numbers, booleans, dates, flow/block lists of strings, and one level
 * of nested objects and list-of-objects (used for `repost`, `video`,
 * and `changelog`).
 *
 * This is NOT a general YAML parser. It exists only so the build step
 * has zero npm dependencies (this repo has no network access at build
 * time other than what GitHub Actions provides, and we'd rather not
 * depend on that). If the front matter ever needs a real YAML feature
 * this parser doesn't support, swap this file for the `js-yaml` package
 * — everything else in build-journal-index.mjs stays the same.
 */

function stripQuotes(s) {
  const t = s.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    return t.slice(1, -1);
  }
  return t;
}

function coerceScalar(raw) {
  const s = raw.trim();
  if (s === "" || s === "~" || s === "null") return null;
  if (s === "true") return true;
  if (s === "false") return false;
  if (/^-?\d+$/.test(s)) return parseInt(s, 10);
  if (/^-?\d+\.\d+$/.test(s)) return parseFloat(s);
  // flow list: [a, b, c]
  if (s.startsWith("[") && s.endsWith("]")) {
    const inner = s.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(",").map((x) => coerceScalar(x.trim()));
  }
  return stripQuotes(s);
}

function indentOf(line) {
  const m = line.match(/^(\s*)/);
  return m ? m[1].length : 0;
}

/** Parses a YAML-ish block into a JS value, given an array of lines. */
function parseBlock(lines, baseIndent) {
  const result = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      i++;
      continue;
    }
    const ind = indentOf(line);
    if (ind < baseIndent) break;
    if (ind > baseIndent) {
      i++;
      continue;
    } // shouldn't happen if called correctly

    const trimmed = line.trim();

    // list item at this level: "- ..." belongs to an array, handled by caller
    if (trimmed.startsWith("- ")) break;

    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) {
      i++;
      continue;
    }
    const key = trimmed.slice(0, colonIdx).trim();
    const rest = trimmed.slice(colonIdx + 1).trim();

    if (rest !== "") {
      // scalar or flow value on the same line
      result[key] = coerceScalar(rest);
      i++;
      continue;
    }

    // value is on following lines: either a nested block or a list
    let j = i + 1;
    const childLines = [];
    let childIndent = null;
    while (j < lines.length) {
      if (lines[j].trim() === "") {
        childLines.push(lines[j]);
        j++;
        continue;
      }
      const thisIndent = indentOf(lines[j]);
      if (thisIndent <= baseIndent) break;
      if (childIndent === null) childIndent = thisIndent;
      childLines.push(lines[j]);
      j++;
    }

    if (childLines.length === 0) {
      result[key] = null;
      i = j;
      continue;
    }

    const firstMeaningful = childLines.find((l) => l.trim() !== "");
    if (firstMeaningful && firstMeaningful.trim().startsWith("- ")) {
      result[key] = parseList(childLines, childIndent);
    } else {
      result[key] = parseBlock(childLines, childIndent);
    }
    i = j;
  }
  return result;
}

/** Parses a block of "- ..." list items (strings, or nested key: value objects). */
function parseList(lines, indent) {
  const items = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      i++;
      continue;
    }
    const ind = indentOf(line);
    if (ind !== indent) {
      i++;
      continue;
    }
    const trimmed = line.trim();
    if (!trimmed.startsWith("- ")) {
      i++;
      continue;
    }
    const afterDash = trimmed.slice(2);

    // "- key: value" starts a list-item object; gather this + deeper-indented lines
    if (/^[\w.-]+:\s*/.test(afterDash)) {
      const itemLines = [" ".repeat(indent + 2) + afterDash];
      let j = i + 1;
      while (j < lines.length) {
        if (lines[j].trim() === "") {
          itemLines.push(lines[j]);
          j++;
          continue;
        }
        const thisIndent = indentOf(lines[j]);
        if (thisIndent <= indent) break;
        itemLines.push(lines[j]);
        j++;
      }
      items.push(parseBlock(itemLines, indent + 2));
      i = j;
    } else {
      items.push(coerceScalar(afterDash));
      i++;
    }
  }
  return items;
}

export function parseFrontMatterYaml(yamlText) {
  const lines = yamlText.replace(/\r\n/g, "\n").split("\n");
  return parseBlock(lines, 0);
}
