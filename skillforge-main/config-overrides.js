const path = require('path');

module.exports = {
  paths: function (paths, env) {
    // Set the app's source and public directories to frontend/skillforge-frontend
    paths.appSrc = path.resolve(__dirname, 'frontend/skillforge-frontend/src');
    paths.appPublic = path.resolve(__dirname, 'frontend/skillforge-frontend/public');
    paths.appIndexJs = path.resolve(__dirname, 'frontend/skillforge-frontend/src/index.js');
    paths.appBuild = path.resolve(__dirname, 'frontend/skillforge-frontend/build');
    paths.appHtml = path.resolve(__dirname, 'frontend/skillforge-frontend/public/index.html');
    paths.appPackageJson = path.resolve(__dirname, 'package.json'); // Use root package.json
    return paths;
  },
};