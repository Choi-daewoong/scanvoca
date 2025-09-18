module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // React Native Web 호환성을 위한 플러그인
      ['@babel/plugin-transform-export-namespace-from'],
      // import.meta 지원을 위한 플러그인
      ['@babel/plugin-syntax-import-meta'],
      // React Native Reanimated (필요시)
      'react-native-reanimated/plugin',
    ],
  };
};
