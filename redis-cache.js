require("dotenv").config();
const { init, set, get } = require("node-cache-redis");
const retry = require("async-retry");
// Utilities
const checkPlatform = require("./platform");
const getSignature = require("./signature");
const axios = require("axios");

init({
  name: "tauri_tablo_releases",
  defaultTtlInS: 60 * 60 * 2, // 2 hours
});

const refreshCache = async () => {
  const cache = await get("releases");
  const lastUpdateDate = await get("lastUpdateDate");
  const { GITHUB_TOKEN, GITHUB_REPO, GITHUB_ACCOUNT } = process.env;

  const repo = GITHUB_ACCOUNT + "/" + GITHUB_REPO;
  const url = `https://api.github.com/repos/${repo}/releases?per_page=100`;

  const headers = { Accept: "application/vnd.github.preview" };

  if (
    GITHUB_TOKEN &&
    typeof GITHUB_TOKEN === "string" &&
    GITHUB_TOKEN.length > 0
  ) {
    headers.Authorization = `token ${GITHUB_TOKEN}`;
  }
  const response = await retry(
    async () => {
      const response = await axios.get(url, { headers });

      if (response.status !== 200) {
        throw new Error(
          `GitHub API responded with ${response.status} for url ${url}`
        );
      }

      return response;
    },
    { retries: 3 }
  );

  const data = await response.data;

  if (!Array.isArray(data) || data.length === 0) {
    return;
  }

  const release = data.find((item) => {
    return !item.draft;
  });

  if (!release || !release.assets || !Array.isArray(release.assets)) {
    return;
  }

  const { tag_name } = release;
  if (cache && cache.version === tag_name) {
    await set("lastUpdateDate", Date.now());
    return;
  }

  const newCache = {
    version: tag_name,
    notes: release.body,
    pub_date: release.published_at,
    platforms: {},
  };

  for (const asset of release.assets) {
    const { name, browser_download_url, url, content_type, size } = asset;
    const platform = checkPlatform(name);
    if (!platform) {
      continue;
    }

    const signature = await getSignature(name, release.assets);

    newCache.platforms[platform] = {
      name,
      api_url: url,
      url: browser_download_url,
      signature,
      content_type,
      size: Math.round((size / 1000000) * 10) / 10,
    };
  }

  await set("releases", newCache);
  await set("lastUpdateDate", Date.now());
};

const loadCache = async () => {
  const cache = await get("releases");
  if (cache) {
    return cache;
  }
  await refreshCache();
  return await get("releases");
};

const proxyPrivateDownload = async (asset, req, res) => {
  const { GITHUB_TOKEN, GITHUB_REPO, GITHUB_ACCOUNT } = process.env;
  const redirect = "manual";
  const headers = { Accept: "application/octet-stream" };
  const options = { headers, redirect };
  const { api_url: rawUrl } = asset;
  const finalUrl = rawUrl.replace(
    "https://api.github.com/",
    `https://${GITHUB_TOKEN}@api.github.com/`
  );

  const { data } = await axios.get(finalUrl, options);

  return res.redirect(data.headers.get("Location"));
};

module.exports = {
  loadCache,
  refreshCache,
  proxyPrivateDownload,
};
