const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

// Find the project and workspace directories
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../");

const config = getDefaultConfig(projectRoot);

// 1. Watch specific folders instead of the whole workspaceRoot
// This prevents Metro from crashing when Next.js alters files in frontend/.next
config.watchFolders = [
  projectRoot,
  path.resolve(workspaceRoot, "node_modules"),
  path.resolve(workspaceRoot, "frontend/crypto-engine"),
];

// 2. Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// 3. Force Metro to resolve (sub)dependencies from the `nodeModulesPaths`
config.resolver.disableHierarchicalLookup = true;

// 4. Resolve the shared crypto engine
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  "@password-manager/crypto-engine": path.resolve(workspaceRoot, "frontend/crypto-engine"),
  "crypto": require.resolve("crypto-browserify"),
  "stream": require.resolve("stream-browserify"),
  "vm": require.resolve("vm-browserify"),
};

config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

module.exports = config;
