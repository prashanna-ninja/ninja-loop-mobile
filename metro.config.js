const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Keep Metro out of the read-only reference projects (they have their own node_modules).
config.resolver.blockList = [/[\/]ref[\/].*/];

module.exports = withNativeWind(config, { input: "./src/global.css" });
