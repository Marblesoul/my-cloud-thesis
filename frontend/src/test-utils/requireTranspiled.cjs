const Module = require("module");
const path = require("path");

const babel = require("@babel/core");

function requireTranspiled(relativePath) {
  const filename = path.resolve(__dirname, "..", relativePath);
  const code = babel.transformFileSync(filename, {
    babelrc: false,
    configFile: false,
    presets: [
      [
        "@babel/preset-env",
        {
          targets: { node: "current" },
        },
      ],
      ["@babel/preset-react", { runtime: "automatic" }],
    ],
  }).code;
  const mod = new Module(filename, module.parent);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(code, filename);
  return mod.exports;
}

module.exports = { requireTranspiled };
