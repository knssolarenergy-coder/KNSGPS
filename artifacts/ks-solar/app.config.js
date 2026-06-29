const appJson = require('./app.json');

module.exports = {
  ...appJson.expo,
  android: {
    ...appJson.expo.android,
    config: {
      googleMaps: {
        apiKey: process.env.GOOGLE_MAPS_API_KEY ?? '',
      },
    },
  },
};
