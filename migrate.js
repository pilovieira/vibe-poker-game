const fs = require('fs');
const path = require('path');
const { createClient } = require('redis');

function getAllMondaysInYear(year) {
  const mondays = [];
  const date = new Date(year, 0, 1);
  // Find first Monday of the year
  while (date.getDay() !== 1) {
    date.setDate(date.getDate() + 1);
  }
  // Collect all Mondays in the year
  while (date.getFullYear() === year) {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    mondays.push(`${dd}/${mm}/${yyyy}`);
    date.setDate(date.getDate() + 7);
  }
  return mondays;
}

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function runMigration() {
  console.log('Starting full migration: converting all historical rankings to game records...');

  const dbPath = path.join(__dirname, 'public', 'database.js');
  if (!fs.existsSync(dbPath)) {
    console.error(`Error: ${dbPath} does not exist!`);
    process.exit(1);
  }

  let dbContent = fs.readFileSync(dbPath, 'utf8');
  dbContent += '\nmodule.exports = { rankingsData, hallOfFameData, avatarsData };';

  const tempDbPath = path.join(__dirname, 'database_temp.js');
  fs.writeFileSync(tempDbPath, dbContent, 'utf8');

  const { rankingsData, hallOfFameData, avatarsData } = require(tempDbPath);
  fs.unlinkSync(tempDbPath);

  // 1. Gather all players
  const playersSet = new Set();
  Object.keys(avatarsData).forEach(name => playersSet.add(name));
  hallOfFameData.forEach(item => playersSet.add(item.name));
  Object.values(rankingsData).forEach(yearList => {
    yearList.forEach(p => playersSet.add(p.name));
  });
  const playersList = Array.from(playersSet).sort();

  // 2. Generate games list
  const allGames = [];

  // Reconstruct 2026 games exactly
  const games2026Map = {};
  if (rankingsData['2026']) {
    rankingsData['2026'].forEach(player => {
      if (player.dates) {
        player.dates.forEach(date => {
          if (!games2026Map[date]) {
            games2026Map[date] = { date, winner1: player.name, winner2: null };
          } else {
            games2026Map[date].winner1 = player.name;
          }
        });
      }
      if (player.sec) {
        player.sec.forEach(date => {
          if (!games2026Map[date]) {
            games2026Map[date] = { date, winner1: null, winner2: player.name };
          } else {
            games2026Map[date].winner2 = player.name;
          }
        });
      }
    });
  }

  // Add 2026 games
  Object.values(games2026Map).forEach(game => {
    allGames.push(game);
  });

  // Generate random Monday games for other years: 2025, 2024, 2023
  const historicalYears = ['2025', '2024', '2023'];
  historicalYears.forEach(yearStr => {
    const year = parseInt(yearStr);
    const yearRankings = rankingsData[yearStr];
    if (!yearRankings) return;

    // Collect all wins for this year
    const winners = [];
    yearRankings.forEach(player => {
      for (let i = 0; i < player.wins; i++) {
        winners.push(player.name);
      }
    });

    if (winners.length === 0) return;

    // Get all Mondays in this year and shuffle them
    const mondays = getAllMondaysInYear(year);
    const shuffledMondays = shuffle(mondays);

    if (winners.length > shuffledMondays.length) {
      console.warn(`Warning: More wins (${winners.length}) than Mondays (${shuffledMondays.length}) in year ${year}!`);
    }

    // Assign a unique Monday to each win
    winners.forEach((winnerName, idx) => {
      const date = shuffledMondays[idx % shuffledMondays.length];
      allGames.push({
        date,
        winner1: winnerName,
        winner2: null
      });
    });
  });

  // Sort ALL games chronologically
  allGames.sort((a, b) => {
    const dateA = a.date.split('/').reverse().join('');
    const dateB = b.date.split('/').reverse().join('');
    return dateA.localeCompare(dateB);
  });

  // Assign sequential IDs
  const gamesList = allGames.map((game, index) => ({
    id: (index + 1).toString(),
    ...game
  }));

  // Build Hall of Fame
  const hallOfFameList = hallOfFameData.map((item, index) => ({
    id: (index + 1).toString(),
    name: item.name,
    date: item.date,
    hand: item.hand
  }));

  // Save to Redis
  const client = createClient();
  client.on('error', err => console.error('Redis Client Error', err));

  try {
    await client.connect();
    console.log('Connected to local Redis.');

    await client.set('vibe-poker:players', JSON.stringify(playersList));
    await client.set('vibe-poker:avatars', JSON.stringify(avatarsData));
    await client.set('vibe-poker:games', JSON.stringify(gamesList));
    await client.set('vibe-poker:hall_of_fame', JSON.stringify(hallOfFameList));
    // Set historical rankings to empty object since they are now derived from games
    await client.set('vibe-poker:historical_rankings', JSON.stringify({}));

    console.log('\n=========================================');
    console.log(`Migration completed successfully!`);
    console.log(`Total games created: ${gamesList.length}`);
    console.log('All historical rankings converted to games.');
    console.log('=========================================');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await client.disconnect();
    console.log('Disconnected from Redis.');
  }
}

runMigration();
