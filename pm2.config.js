require("dotenv").config();
module.exports = {
  apps: [
    {
      name: process.env.PM2_APP_NAME,
      script: "./server.js",
      watch: false,
      env: {
        PORT: 3000,
        NODE_ENV: "development",
      },
      env_production: {
        PORT: process.env.NODE_PORT,
        NODE_ENV: "production",
        GITHUB_ACCOUNT: "shahzodsalimsakov",
        GITHUB_REPO: "tauritablo",
        GITHUB_TOKEN: "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",
      },
    },
  ],
};
