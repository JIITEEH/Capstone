// For tests of a server running behind one proxy. Imported first, before anything reads config,
// because ES module imports run before the rest of a test file does.
import './setup.js';

process.env.TRUST_PROXY = '1';
