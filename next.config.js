module.exports = {
  reactStrictMode: true,
  webpack(config) {
    config.experiments = {
      syncWebAssembly: true,
    };
    return config;
  },
};
