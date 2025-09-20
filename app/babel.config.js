module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // React Native Reanimated (최신 버전)
      'react-native-worklets/plugin',
    ],
  };
};
