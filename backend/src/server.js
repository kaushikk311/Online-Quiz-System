require('dotenv').config();
const app = require('./app');
const { startAutoSubmitJob } = require('./jobs/autoSubmit');

const PORT = process.env.PORT || 5000;

if (!process.env.JWT_SECRET) {
  console.log('JWT_SECRET is missing in .env file');
  process.exit(1);
}

app.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
  startAutoSubmitJob();
});
