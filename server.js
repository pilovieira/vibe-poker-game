const dotenv = require('dotenv');
const express = require('express');
const path = require('path');
const { createClient } = require('redis');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3100;

app.use(express.json());

// Initialize Redis Client
const client = createClient();
client.on('error', err => console.error('Redis Client Error', err));

async function startServer() {
  try {
    await client.connect();
    console.log('Connected to local Redis database.');

    // 1. Dynamic database.js endpoint
    app.get('/database.js', async (req, res) => {
      try {
        const players = JSON.parse(await client.get('vibe-poker:players') || '[]');
        const avatars = JSON.parse(await client.get('vibe-poker:avatars') || '{}');
        const historicalRankings = JSON.parse(await client.get('vibe-poker:historical_rankings') || '{}');
        const games = JSON.parse(await client.get('vibe-poker:games') || '[]');
        const hallOfFame = JSON.parse(await client.get('vibe-poker:hall_of_fame') || '[]');

        // Compile rankingsData dynamically from historical rankings + games
        const rankingsData = JSON.parse(JSON.stringify(historicalRankings)); // deep clone

        games.forEach(game => {
          if (!game.date) return;
          const parts = game.date.split('/');
          if (parts.length < 3) return;
          const year = parts[2];

          if (!rankingsData[year]) {
            rankingsData[year] = [];
          }

          if (game.winner1) {
            let pRecord = rankingsData[year].find(p => p.name === game.winner1);
            if (!pRecord) {
              pRecord = { name: game.winner1, wins: 0, dates: [], sec: [] };
              rankingsData[year].push(pRecord);
            }
            pRecord.wins += 1;
            if (!pRecord.dates) pRecord.dates = [];
            pRecord.dates.push(game.date);
          }

          if (game.winner2) {
            let pRecord = rankingsData[year].find(p => p.name === game.winner2);
            if (!pRecord) {
              pRecord = { name: game.winner2, wins: 0, dates: [], sec: [] };
              rankingsData[year].push(pRecord);
            }
            if (!pRecord.sec) pRecord.sec = [];
            pRecord.sec.push(game.date);
          }
        });

        // Ensure every registered player is in the rankings of the latest active year
        // so they are processed by getPlayerStats() on the client and show up in the Players tab
        const years = Object.keys(rankingsData);
        if (years.length > 0) {
          const latestYear = years.sort((a, b) => b - a)[0];
          players.forEach(name => {
            let pRecord = rankingsData[latestYear].find(p => p.name === name);
            if (!pRecord) {
              rankingsData[latestYear].push({ name, wins: 0, dates: [], sec: [] });
            }
          });
        }

        // Ensure every player in the list for a year is formatted correctly
        Object.keys(rankingsData).forEach(year => {
          rankingsData[year].forEach(p => {
            if (!p.dates) p.dates = [];
            if (!p.sec) p.sec = [];
          });
          // Sort by wins descending
          rankingsData[year].sort((a, b) => b.wins - a.wins);
        });

        const jsContent = `// Dynamically generated from Redis
const rankingsData = ${JSON.stringify(rankingsData, null, 2)};
const hallOfFameData = ${JSON.stringify(hallOfFame, null, 2)};
const avatarsData = ${JSON.stringify(avatars, null, 2)};
`;

        res.setHeader('Content-Type', 'application/javascript');
        res.send(jsContent);
      } catch (error) {
        console.error('Error generating database.js:', error);
        res.status(500).send('console.error("Error: Failed to load dynamic database.js from server.");');
      }
    });

    // 2. API: Avatars (read-only)
    app.get('/api/avatars', async (req, res) => {
      try {
        const avatars = JSON.parse(await client.get('vibe-poker:avatars') || '{}');
        res.json(avatars);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // 3. API: Players management
    app.get('/api/players', async (req, res) => {
      try {
        const players = JSON.parse(await client.get('vibe-poker:players') || '[]');
        res.json(players);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.post('/api/players', async (req, res) => {
      try {
        const { name } = req.body;
        if (!name || name.trim() === '') {
          return res.status(400).json({ error: 'Player name is required.' });
        }

        const trimmedName = name.trim();
        const players = JSON.parse(await client.get('vibe-poker:players') || '[]');
        if (players.map(p => p.toLowerCase()).includes(trimmedName.toLowerCase())) {
          return res.status(400).json({ error: 'Player already exists.' });
        }

        players.push(trimmedName);
        players.sort();
        await client.set('vibe-poker:players', JSON.stringify(players));

        res.status(201).json(players);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.delete('/api/players/:name', async (req, res) => {
      try {
        const { name } = req.params;
        let players = JSON.parse(await client.get('vibe-poker:players') || '[]');
        const filtered = players.filter(p => p !== name);

        if (players.length === filtered.length) {
          return res.status(404).json({ error: 'Player not found.' });
        }

        await client.set('vibe-poker:players', JSON.stringify(filtered));

        // Clean up avatars mapping if present
        const avatars = JSON.parse(await client.get('vibe-poker:avatars') || '{}');
        if (avatars[name]) {
          delete avatars[name];
          await client.set('vibe-poker:avatars', JSON.stringify(avatars));
        }

        res.json(filtered);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // 3. API: Games management
    app.get('/api/games', async (req, res) => {
      try {
        const games = JSON.parse(await client.get('vibe-poker:games') || '[]');
        res.json(games);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.post('/api/games', async (req, res) => {
      try {
        const { date, winner1, winner2 } = req.body;
        if (!date || !winner1) {
          return res.status(400).json({ error: 'Date and 1st place winner are required.' });
        }

        const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
        if (!dateRegex.test(date)) {
          return res.status(400).json({ error: 'Date must be in format DD/MM/YYYY.' });
        }

        const games = JSON.parse(await client.get('vibe-poker:games') || '[]');
        
        // Generate new ID
        let maxId = 0;
        games.forEach(g => {
          const idNum = parseInt(g.id) || 0;
          if (idNum > maxId) maxId = idNum;
        });
        const newId = (maxId + 1).toString();

        const newGame = {
          id: newId,
          date,
          winner1,
          winner2: winner2 || null
        };

        games.push(newGame);
        
        // Sort games chronologically
        games.sort((a, b) => {
          const dateA = a.date.split('/').reverse().join('');
          const dateB = b.date.split('/').reverse().join('');
          return dateA.localeCompare(dateB);
        });

        await client.set('vibe-poker:games', JSON.stringify(games));
        res.status(201).json(newGame);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.delete('/api/games/:id', async (req, res) => {
      try {
        const { id } = req.params;
        let games = JSON.parse(await client.get('vibe-poker:games') || '[]');
        const filtered = games.filter(g => g.id !== id);

        if (games.length === filtered.length) {
          return res.status(404).json({ error: 'Game record not found.' });
        }

        await client.set('vibe-poker:games', JSON.stringify(filtered));
        res.json({ success: true, games: filtered });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // 4. API: Hall of Fame management
    app.get('/api/hof', async (req, res) => {
      try {
        const hof = JSON.parse(await client.get('vibe-poker:hall_of_fame') || '[]');
        res.json(hof);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.post('/api/hof', async (req, res) => {
      try {
        const { name, date, hand } = req.body;
        if (!name || !date || !hand) {
          return res.status(400).json({ error: 'Name, date and hand are required.' });
        }

        const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
        if (!dateRegex.test(date)) {
          return res.status(400).json({ error: 'Date must be in format DD/MM/YYYY.' });
        }

        const hof = JSON.parse(await client.get('vibe-poker:hall_of_fame') || '[]');
        
        let maxId = 0;
        hof.forEach(h => {
          const idNum = parseInt(h.id) || 0;
          if (idNum > maxId) maxId = idNum;
        });
        const newId = (maxId + 1).toString();

        const newEntry = {
          id: newId,
          name,
          date,
          hand
        };

        hof.push(newEntry);
        
        // Sort Hall of Fame entries chronologically descending (newest first) or ascending. 
        // Original data lists latest on top, so we will sort descending.
        hof.sort((a, b) => {
          const dateA = a.date.split('/').reverse().join('');
          const dateB = b.date.split('/').reverse().join('');
          return dateB.localeCompare(dateA);
        });

        await client.set('vibe-poker:hall_of_fame', JSON.stringify(hof));
        res.status(201).json(newEntry);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.delete('/api/hof/:id', async (req, res) => {
      try {
        const { id } = req.params;
        let hof = JSON.parse(await client.get('vibe-poker:hall_of_fame') || '[]');
        const filtered = hof.filter(h => h.id !== id);

        if (hof.length === filtered.length) {
          return res.status(404).json({ error: 'Hall of fame entry not found.' });
        }

        await client.set('vibe-poker:hall_of_fame', JSON.stringify(filtered));
        res.json({ success: true, hof: filtered });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Serve static files from public folder
    app.use(express.static(path.join(__dirname, 'public')));

    // Catch-all route to fallback to index.html
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    app.listen(PORT, () => {
      console.log(`Server is running at http://localhost:${PORT}`);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
