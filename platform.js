// Native
const { extname } = require("path");

module.exports = (fileName) => {
  const extension = extname(fileName).slice(1);

  // OSX we should have our .app tar.gz
  if (
    (fileName.includes(".app") ||
      fileName.includes("darwin") ||
      fileName.includes("osx")) &&
    extension === "gz"
  ) {
    return "darwin";
  }

  // Windows 64 bits
  if (
    (fileName.includes("x64") || fileName.includes("win64")) &&
    extension === "zip"
  ) {
    return "win64";
  }

  // Windows 32 bits
  if (
    (fileName.includes("x32") || fileName.includes("win32")) &&
    extension === "zip"
  ) {
    return "win32";
  }

  // Linux app image
  if (fileName.includes("AppImage") && extension === "gz") {
    return "appimage";
  }

  const directCache = ["msi", "dmg", "rpm", "deb"];
  return directCache.find((ext) => ext === extension) || false;
};
