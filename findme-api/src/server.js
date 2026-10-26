const config = require('./config/env');
const { createApp } = require('./app');

createApp().listen(config.port, () => {
  console.log(`FindMe is running at http://localhost:${config.port}`);
});
