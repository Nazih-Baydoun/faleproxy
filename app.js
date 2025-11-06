const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001; // allow overriding for tests

// Middleware to parse request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Route to serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Helper function: case-aware Yale→Fale replacement
function replaceYaleWithFale(text) {
  return text
    .replace(/\bYALE\b/g, 'FALE')   // fully uppercase
    .replace(/\bYale\b/g, 'Fale')   // capitalized
    .replace(/\byale\b/g, 'fale');  // lowercase
}

// API endpoint to fetch and modify content
app.post('/fetch', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Fetch the content from the provided URL
    const response = await axios.get(url);
    const html = response.data;
    const $ = cheerio.load(html);

    // Replace text in the title
    const title = replaceYaleWithFale($('title').text());
    $('title').text(title);

    // Replace text nodes in the body (but not URLs or attributes)
    $('body *')
      .contents()
      .filter(function () {
        return this.nodeType === 3; // text nodes only
      })
      .each(function () {
        const text = $(this).text();
        const newText = replaceYaleWithFale(text);
        if (text !== newText) {
          $(this).replaceWith(newText);
        }
      });

    return res.json({
      success: true,
      content: $.html(),
      title,
      originalUrl: url,
    });
  } catch (error) {
    console.error('Error fetching URL:', error.message);
    return res.status(500).json({
      error: `Failed to fetch content: ${error.message}`,
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Faleproxy server running at http://localhost:${PORT}`);
});

module.exports = app; // exported for tests if needed
