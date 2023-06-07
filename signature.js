require("dotenv").config();
const retry = require("async-retry");
const convertStream = require("stream-to-string");
const axios = require("axios");

module.exports = async (fileName, assets) => {
  // Look if we can find a signature...
  const foundSignature = assets.find(
    (asset) => asset.name === `${fileName}.sig`
  );

  if (!foundSignature) {
    return null;
  }

  const { data } = await retry(
    async () => {
      const response = await axios.get(foundSignature.browser_download_url, {
        responseType: "stream",
        httpsAgent: new (require("https").Agent)({
          rejectUnauthorized: false,
        }),
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        },
      });

      if (response.status !== 200) {
        throw new Error(
          `GitHub API responded with ${response.status} for url ${foundSignature.browser_download_url}`
        );
      }

      return response;
    },
    { retries: 3 }
  );

  const content = await convertStream(data);
  return content;
};
