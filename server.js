// Require the framework and instantiate it
require("dotenv").config();
const fastify = require("fastify")({ logger: true });
const { Liquid } = require("liquidjs");
const path = require("path");
const distanceInWordsToNow = require("date-fns/formatDistanceToNow");
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
    platform = "exe";
  }

  // Get the latest version from the cache
  const { platforms } = await loadCache();

  if (!platform || !platforms || !platforms[platform]) {
    return reply.code(404).send("No download available for your platform!");
  }

  if (shouldProxyPrivateDownload) {
    return proxyPrivateDownload(platforms[platform], request, reply);
  }

  return reply.redirect(platforms[platform].url);

  return request.userAgent.os.toString();
});

fastify.get("/releases", async (request, reply) => {
  return { hello: "world" };
});

// Run the server!
const start = async () => {
  try {
    await fastify.listen({ port: 3000 });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();
