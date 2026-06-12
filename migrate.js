const fs = require('fs');
const path = require('path');
const { createClient } = require('redis');

async function runMigration() {
  console.log('Starting migration from public/database.js to local Redis...');

  // 1. Read and mock import of public/database.js
  const dbPath = path.join(__dirname, 'public', 'database.js');
  if (!fs.existsSync(dbPath)) {
    console.error(`Error: ${dbPath} does not exist!`);
    process.exit(1);
  }

  let dbContent = fs.readFileSync(dbPath, 'utf8');
  // Append module exports to evaluate it in Node environment
  dbContent += '\nmodule.exports = { rankingsData, hallOfFameData, avatarsData };';

  const tempDbPath = path.join(__dirname, 'database_temp.js');
  fs.writeFileSync(tempDbPath, dbContent, 'utf8');

  // Load the data
  const { rankingsData, hallOfFameData, avatarsData } = require(tempDbPath);

  // Clean up temp file
  fs.unlinkSync(tempDbPath);

  // 2. Extract unique players list
  const playersSet = new Set();
  // Extract from avatarsData keys
  Object.keys(avatarsData).forEach(name => playersSet.add(name));
  // Extract from hallOfFameData
  hallOfFameData.forEach(item => playersSet.add(item.name));
  // Extract from rankingsData
  Object.values(rankingsData).forEach(yearList => {
    yearList.forEach(p => playersSet.add(p.name));
  });

  const playersList = Array.from(playersSet).sort();
  console.log(`Extracted ${playersList.length} unique players:`, playersList);

  // 3. Extract historical rankings (pre-2026)
  const historicalRankings = {};
  Object.keys(rankingsData).forEach(year => {
    if (parseInt(year) < 2026) {
      historicalRankings[year] = rankingsData[year];
    }
  });
  console.log('Extracted historical ranking years:', Object.keys(historicalRankings));

  // 4. Reconstruct 2026 games list from win/runner-up dates
  const gamesMap = {};
  if (rankingsData['2026']) {
    rankingsData['2026'].forEach(player => {
      if (player.dates) {
        player.dates.forEach(date => {
          if (!gamesMap[date]) {
            gamesMap[date] = { date, winner1: player.name, winner2: null };
          } else {
            gamesMap[date].winner1 = player.name;
          }
        });
      }
      if (player.sec) {
        player.sec.forEach(date => {
          if (!gamesMap[date]) {
            gamesMap[date] = { date, winner1: null, winner2: player.name };
          } else {
            gamesMap[date].winner2 = player.name;
          }
        });
      }
    });
  }

  // Sort dates chronologically (DD/MM/YYYY format)
  const sortedDates = Object.keys(gamesMap).sort((a, b) => {
    const dateA = a.split('/').reverse().join('');
    const dateB = b.split('/').reverse().join('');
    return dateA.localeCompare(dateB);
  });

  const gamesList = sortedDates.map((date, index) => ({
    id: (index + 1).toString(),
    date,
    winner1: gamesMap[date].winner1,
    winner2: gamesMap[date].winner2
  }));
  console.log(`Reconstructed ${gamesList.length} games for 2026:`, gamesList);

  // 5. Build Hall of Fame list with unique IDs
  const hallOfFameList = hallOfFameData.map((item, index) => ({
    id: (index + 1).toString(),
    name: item.name,
    date: item.date,
    hand: item.hand
  }));
  console.log(`Processed ${hallOfFameList.length} Hall of Fame entries.`);

  // 6. Connect to Redis and Seed Keys
  const client = createClient();
  client.on('error', err => console.error('Redis Client Error', err));

  try {
    await client.connect();
    console.log('Connected to local Redis.');

    // Save under key path prefix 'vibe-poker'
    await client.set('vibe-poker:players', JSON.stringify(playersList));
    await client.set('vibe-poker:avatars', JSON.stringify(avatarsData));
    await client.set('vibe-poker:historical_rankings', JSON.stringify(historicalRankings));
    await client.set('vibe-poker:games', JSON.stringify(gamesList));
    await client.set('vibe-poker:hall_of_fame', JSON.stringify(hallOfFameList));

    console.log('\n=========================================');
    console.log('Migration completed successfully!');
    console.log('Data successfully saved in local Redis.');
    console.log('=========================================');

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await client.disconnect();
    console.log('Disconnected from Redis.');
  }
}

runMigration();
