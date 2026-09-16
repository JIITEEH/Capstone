import app from './app.js';
import config from './config/index.js';
import { isEmailConfigured } from './helpers/email.js';

app.listen(config.port, () => {
  console.log(`API running at http://localhost:${config.port}`);
  if (config.env === 'production' && config.trustProxy === false) {
    console.warn(
      'TRUST_PROXY is not set. If this server runs behind nginx or a hosting platform, set TRUST_PROXY=1, ' +
        'or every visitor will share one rate limit. See DEPLOYMENT.md.',
    );
  }
  if (config.env === 'production' && !isEmailConfigured()) {
    console.warn('SMTP_HOST is not set, so password reset emails will not be sent. See DEPLOYMENT.md.');
  }
});
