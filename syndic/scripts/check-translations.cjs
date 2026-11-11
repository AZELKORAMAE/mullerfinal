const ts = require("ts-ast"),
  fs = require("fs"),
  path = require("path");
const data = {
  ...JSON.parse(fs.readFileSync("src/lib/translations-data.json", "utf8")),
  ...JSON.parse(fs.readFileSync("src/lib/translations-errors.json", "utf8")),
};
const missing = new Set();
function scan(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, e.name);
    if (e.isDirectory()) scan(file);
    else if (file.endsWith(".tsx")) {
      const src = ts.createSourceFile(
        file,
        fs.readFileSync(file, "utf8"),
        99,
        true,
        ts.ScriptKind.TSX,
      );
      function walk(n) {
        if (
          ts.isJsxAttribute(n) &&
          n.name.text === "text" &&
          n.initializer &&
          ts.isStringLiteral(n.initializer) &&
          !data[n.initializer.text]
        )
          missing.add(n.initializer.text);
        ts.forEachChild(n, walk);
      }
      walk(src);
    }
  }
}
scan("src");
console.log(JSON.stringify([...missing], null, 2));
if (missing.size) process.exitCode = 1;
