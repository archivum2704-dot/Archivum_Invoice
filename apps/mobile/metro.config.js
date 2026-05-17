const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

// Monorepo root
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch all files in monorepo
config.watchFolders = [workspaceRoot];

// Resolve packages from monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Force critical RN packages to always resolve from the mobile app's own
// node_modules. In a pnpm monorepo, Metro can pick up a second copy from the
// workspace root, causing two separate instances of react-native at runtime.
// That makes TurboModuleRegistry.getEnforcing('PlatformConstants') fail with
// "could not be found" because the native side registered with a different
// module-system instance than the one the bundle is calling into.
const DEDUPLICATE = [
  "react",
  "react-native",
  "react-native-reanimated",
  "@react-native",
  "@react-native-community",
  "expo",
  "expo-modules-core",
];

config.resolver.extraNodeModules = Object.fromEntries(
  DEDUPLICATE.map((pkg) => [
    pkg,
    path.resolve(projectRoot, "node_modules", pkg),
  ])
);

module.exports = withNativeWind(config, { input: "./global.css" });
