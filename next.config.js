const isProd = process.env.NODE_ENV === 'production';
const repoBase = '/web-interface';

const nextConfig = {
  reactStrictMode: true,
  trailingSlash: true,
  output: 'export',
  basePath: isProd ? repoBase : '',
  assetPrefix: isProd ? `${repoBase}/` : '',
  images: { unoptimized: true },
  experimental: {
    turbo: {
      resolveAlias: {
        react: 'preact/compat',
        'react-dom/test-utils': 'preact/test-utils',
        'react-dom': 'preact/compat',
        'react/jsx-runtime': 'preact/jsx-runtime'
      }
    }
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        react: 'preact/compat',
        'react-dom/test-utils': 'preact/test-utils',
        'react-dom': 'preact/compat',
        'react/jsx-runtime': 'preact/jsx-runtime'
      };
    }
    return config;
  }
};

module.exports = nextConfig;
