const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(bodyParser.json({ limit: '2mb' }));

// Movie list
const movieList = fs.readFileSync('movies.txt', 'utf-8')
  .split('\n')
  .map(title => title.trim().toLowerCase())
  .filter(title => title.length >= 2);

let lastMatches = [];

// File upload setup
const storage = multer.diskStorage({
  destination: './public/uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

app.post('/upload', upload.single('image'), (req, res) => {
const imageUrl = `https://movie-backend.onrender.com/uploads/${req.file.filename}`;

  res.json({ imageUrl });
});

// Quote scan route
app.post('/api/scan-page', (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'No content received' });

  const bodyOnly = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || '';
  const lowerContent = bodyOnly.toLowerCase();

  const matches = movieList.filter(title => {
    const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const isShort = title.length <= 3;

    let found = null;

    if (isShort) {
      const yearPattern = new RegExp(
        `(\\d{4}.{0,10})?(?<!\\w)${escapedTitle}(?!\\w)(.{0,10}\\d{4})?`,
        'gi'
      );
      found = lowerContent.match(yearPattern);

      if (found && found.length > 1) {
        const quotePattern = new RegExp(
          `(quotes?.{0,10})?(?<!\\w)${escapedTitle}(?!\\w)(.{0,10}quotes?)?`,
          'gi'
        );
        found = lowerContent.match(quotePattern) || found;
      }

      if (found && found.length > 1) {
        const movieShowPattern = new RegExp(
          `(movie|show).{0,10}(?<!\\w)${escapedTitle}(?!\\w)|(?<!\\w)${escapedTitle}(?!\\w).{0,10}(movie|show)`,
          'gi'
        );
        found = lowerContent.match(movieShowPattern) || found;
      }

      if (found && found.length > 1) {
        found = [found[0]];
      }

    } else {
      const pattern = new RegExp(`(?<![\\w"'])${escapedTitle}(?![\\w"'])`, 'gi');
      found = lowerContent.match(pattern);
    }

    return found && found.length >= 3;
  });

  lastMatches = matches;

  console.log('📥 Received page content from extension');
  console.log('🎯 Regex Matches found:', lastMatches);

  res.json({
    status: 'ok',
    totalMatches: lastMatches.length,
    matches: lastMatches
  });
});

app.get('/api/get-matches', (req, res) => {
  res.json({
    total: lastMatches.length,
    matches: lastMatches
  });
});

app.listen(PORT, () => {
console.log(`Server running (Render redeploy test) on http://localhost:${PORT}`);
});
