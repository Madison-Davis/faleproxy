const axios = require('axios');
const cheerio = require('cheerio');
const { sampleHtmlWithYale } = require('./test-utils');
const nock = require('nock');

// Set a different port for testing to avoid conflict with the main app
const TEST_PORT = 3099;
let server;

describe('Integration Tests', () => {
  beforeAll(async () => {
    // Mock console.error to suppress error logs during tests
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Setup nock to intercept external requests
    nock.cleanAll();
    nock('https://example.com')
      .get('/')
      .reply(200, sampleHtmlWithYale)
      .persist();
    
    // Import the app directly (don't spawn a new process)
    const app = require('../app');
    
    // Start server in the same process
    server = app.listen(TEST_PORT);
    
    // Give the server time to start
    await new Promise(resolve => setTimeout(resolve, 2000));
  }, 20000); // NOTE: increased timeout for this test as requested (from 10000)

  afterAll(async () => {
    nock.cleanAll();
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  test('Should replace Yale with Fale in fetched content', async () => {
    // NOTE: removed nock setup and made request directly to proxy app

    // Make a request to our proxy app
    const response = await axios.post(`http://localhost:${TEST_PORT}/fetch`, {
      url: 'https://example.com/'
    });
    
    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);
    
    // Verify Yale has been replaced with Fale in text
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
  }, 20000); // NOTE: increased timeout for this test as requested (from 10000)

  test('Should handle invalid URLs', async () => {
    try {
      await axios.post(`http://localhost:${TEST_PORT}/fetch`, {
        url: 'not-a-valid-url'
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
