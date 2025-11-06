const axios = require('axios');
const cheerio = require('cheerio');
const { spawn } = require('child_process');
const { sampleHtmlWithYale } = require('./test-utils');
const nock = require('nock');

// Use a different port for testing
const TEST_PORT = 3099;
let server;

describe('Integration Tests', () => {
  beforeAll(async () => {
    // Mock external HTTP requests
    nock.disableNetConnect();
    nock.enableNetConnect('127.0.0.1');

    // Start the app.js server directly with a custom test port
    process.env.PORT = TEST_PORT;
    server = spawn('node', ['app.js'], {
      detached: true,
      stdio: 'ignore',
    });

    // Give server time to boot up
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }, 10000); // Allow up to 10s startup

  afterAll(async () => {
    // Kill the spawned process
    if (server && server.pid) {
      process.kill(-server.pid);
    }

    // Restore normal networking
    nock.cleanAll();
    nock.enableNetConnect();
  });

  test('Should replace Yale with Fale in fetched content', async () => {
    // Mock the external request
    nock('https://example.com').get('/').reply(200, sampleHtmlWithYale);

    // Send request to our proxy
    const response = await axios.post(`http://localhost:${TEST_PORT}/fetch`, {
      url: 'https://example.com/',
    });

    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);

    // Parse HTML
    const $ = cheerio.load(response.data.content);
    expect($('title').text()).toBe('Fale University Test Page');
    expect($('h1').text()).toBe('Welcome to Fale University');
    expect($('p').first().text()).toContain('Fale University is a private');

    // Verify URLs remain unchanged
    const links = $('a');
    let hasYaleUrl = false;
    links.each((i, link) => {
      const href = $(link).attr('href');
      if (href && href.includes('yale.edu')) {
        hasYaleUrl = true;
      }
    });
    expect(hasYaleUrl).toBe(true);

    // Verify link text is changed
    expect($('a').first().text()).toBe('About Fale');
  }, 10000);

  test('Should handle invalid URLs', async () => {
    try {
      await axios.post(`http://localhost:${TEST_PORT}/fetch`, {
        url: 'not-a-valid-url',
      });
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      expect(error.response.status).toBe(500);
    }
  });

  test('Should handle missing URL parameter', async () => {
    try {
      await axios.post(`http://localhost:${TEST_PORT}/fetch`, {});
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      expect(error.response.status).toBe(400);
      expect(error.response.data.error).toBe('URL is required');
    }
  });
});
