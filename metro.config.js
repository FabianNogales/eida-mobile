const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)
const existing = config.resolver.blockList
config.resolver.blockList = [
  ...(Array.isArray(existing) ? existing : existing ? [existing] : []),
  // Local toolchains and artifacts are never application source.
  /[/\\](?:\.tools|\.artifacts)[/\\]/,
]

module.exports = config
