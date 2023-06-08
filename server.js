// Require the framework and instantiate it
require("dotenv").config();
const fastify = require("fastify")({ logger: true });
const { Liquid } = require("liquidjs");
const path = require("path");
const distanceInWordsToNow = require("date-fns/formatDistanceToNow");
const { valid, compare } = require("semver");
const checkAlias = require("./aliases");
const {
  loadCache,
  refreshCache,
  proxyPrivateDownload,
} = require("./redis-cache");

const engine = new Liquid({
  root: path.join(__dirname, "views"),
  extname: ".liquid",
});

fastify.register(require("fastify-user-agent"));

fastify.register(require("@fastify/static"), {
  root: path.join(__dirname, "public"),
  prefix: "/", // optional: default '/'
});

fastify.register(require("@fastify/view"), {
  engine: {
    liquid: engine,
  },
});

fastify.get("/", async (request, reply) => {
  const latest = await loadCache();
  try {
    const details = {
      account: process.env.GITHUB_ACCOUNT,
      repository: process.env.GITHUB_REPO,
      date: distanceInWordsToNow(new Date(latest.pub_date), {
        addSuffix: true,
        locale: require("date-fns/locale/ru"),
      }),
      files: latest.platforms,
      version: latest.version,
      releaseNotes: `https://github.com/${process.env.GITHUB_ACCOUNT}/${process.env.GITHUB_REPO}/releases/tag/${latest.version}`,
      allReleases: `https://github.com/${process.env.GITHUB_ACCOUNT}/${process.env.GITHUB_REPO}/releases`,
      github: `https://github.com/${process.env.GITHUB_ACCOUNT}/${process.env.GITHUB_REPO}`,
    };
    return reply.view("./views/index.liquid", details);
  } catch (err) {
    console.error(err);
    reply.code(500).send(err);
  }
});

fastify.get("/refresh-cache", async (request, reply) => {
  await refreshCache();
  return reply.redirect("/");
});

fastify.get("/download", async (request, reply) => {
  const os = request.userAgent.os.toString();
  // console.log("os", os);
  const isMac = os.includes("Mac OS");
  const isWindows = os.includes("Windows");
  const params = request.query;
  const isUpdate = params && params.update;

  const shouldProxyPrivateDownload =
    process.env.GITHUB_TOKEN &&
    typeof process.env.GITHUB_TOKEN === "string" &&
    process.env.GITHUB_TOKEN.length > 0;

  let platform;

  if (isMac && isUpdate) {
    platform = "darwin";
  } else if (isMac && !isUpdate) {
    platform = "dmg";
  } else if (isWindows) {
    platform = "win64";
  }

  // Get the latest version from the cache
  const { platforms } = await loadCache();
  // console.log(platform);
  // console.log(platforms);
  if (!platform || !platforms || !platforms[platform]) {
    return reply.code(404).send("No download available for your platform!");
  }

  // if (shouldProxyPrivateDownload) {
  //   return proxyPrivateDownload(platforms[platform], request, reply);
  // }

  return reply.code(302).redirect(platforms[platform].url);
});

fastify.get("/download/:platform", async (request, reply) => {
  let { platform } = request.params;
  const params = request.query;
  const isUpdate = params && params.update;
  if (platform === "mac" && !isUpdate) {
    platform = "dmg";
  }

  // Get the latest version from the cache
  const latest = await loadCache();

  // Check platform for appropiate aliases
  platform = checkAlias(platform);

  if (!platform) {
    return reply.code(500).send("The specified platform is not valid");
  }

  // console.log(platform);
  // console.log(latest.platforms);

  if (!latest.platforms || !latest.platforms[platform]) {
    return reply.code(404).send("No download available for your platform");
  }

  if (token && typeof token === "string" && token.length > 0) {
    return proxyPrivateDownload(latest.platforms[platform], request, reply);
  }

  return reply.redirect(latest.platforms[platform].url);
});

fastify.get("/update/:platform/:version", async (request, reply) => {
  const { platform: platformName, version } = request.params;
  const latest = await loadCache();

  if (!valid(version)) {
    return reply.code(500).send({
      error: "version_invalid",
      message: "The specified version is not SemVer-compatible",
    });
  }

  // Check platform for appropiate aliases

  const platform = checkAlias(platformName);
  console.log(platform);
  if (!platform) {
    return reply.code(500).send({
      error: "invalid_platform",
      message: "The specified platform is not valid",
    });
  }

  if (!latest.platforms || !latest.platforms[platform]) {
    return reply.code(204).send();
  }

  if (compare(latest.version, version) !== 0) {
    const { notes, pub_date } = latest;
    console.log("platform", latest.platforms[platform]);
    const result = {
      name: latest.version,
      notes,
      pub_date,
      signature: latest.platforms[platform].signature,
      url: /*shouldProxyPrivateDownload
        ? `https://tablo.lesailes.uz/download/${platformName}?update=true`
        : */ latest.platforms[platform].api_url.replace(
        "api.github.com",
        `${process.env.GITHUB_TOKEN}:@api.github.com`
      ),
    };
    console.log("result", result);
    return reply.send(result);
  }

  return reply.code(204).send();
});

fastify.get("/releases", async (request, reply) => {
  return { hello: "world" };
});

// Run the server!
const start = async () => {
  try {
    await fastify.listen({ port: process.env.PORT });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();
