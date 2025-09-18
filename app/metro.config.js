const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Web 환경에서 import.meta 지원을 위한 설정
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Web 환경에서 모듈 해석 개선
config.resolver.alias = {
  ...config.resolver.alias,
};

// Web 환경에서 번들링 최적화
config.transformer.minifierConfig = {
  ...config.transformer.minifierConfig,
  // import.meta 관련 최적화 비활성화
  keep_fnames: true,
  mangle: {
    keep_fnames: true,
  },
};

module.exports = config;
