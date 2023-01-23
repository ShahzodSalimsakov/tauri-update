const aliases = {
  darwin: ["mac", "macos", "osx"],
  win32: ["windows32", "windows", "win"],
  win64: ["windows64"],
  // actually we bind all linux to appimage
  appimage: ["linux32", "linux64", "linux"],
  // Not supported yet
  exe: ["exe"],
  dmg: ["dmg"],
  deb: ["debian"],
  rpm: ["fedora"],
};

module.exports = (platform) => {
  if (typeof aliases[platform] !== "undefined") {
    return platform;
  }

  for (const guess of Object.keys(aliases)) {
    const list = aliases[guess];

    if (list.includes(platform)) {
      return guess;
    }
  }

  return false;
};
