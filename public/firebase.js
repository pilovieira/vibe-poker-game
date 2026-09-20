// Shared Firebase layer: Realtime Database (root path "vibe-poker") + Auth (admin).
// The web config below is public by design; access is enforced by database.rules.json.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js';
import {
  getDatabase, ref, get, set, update, remove, push
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js';
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js';

const app = initializeApp({
  apiKey: 'AIzaSyD2qVqtDkbieFXjTX5kbU8Dp1nuJkhcyOA',
  authDomain: 'pilovieira-sandbox.firebaseapp.com',
  databaseURL: 'https://pilovieira-sandbox.firebaseio.com',
  projectId: 'pilovieira-sandbox',
  appId: '1:1099130718140:web:d3f02e7e0ad42b857d0db9'
});

const db = getDatabase(app);
const auth = getAuth(app);
const ROOT = 'vibe-poker';
const node = (...parts) => ref(db, [ROOT, ...parts].join('/'));

// ---- helpers -------------------------------------------------------------
// Everything is stored as maps keyed by Firebase push ids. Games and Hall of Fame
// entries reference players by player id.
const dateKey = d => d.split('/').reverse().join('');
const DATE_RE = /^\d{2}\/\d{2}\/\d{4}$/;

async function readMap(name) {
  const snap = await get(node(name));
  const out = [];
  snap.forEach(child => { out.push({ id: child.key, ...child.val() }); });
  return out;
}

// ---- reads (public) -----------------------------------------------------
// Players: { id, name, bio, avatar } sorted by name. `avatar` is a small data URL (or null).
export async function getPlayers() {
  return (await readMap('players'))
    .map(p => ({ bio: '', avatar: null, ...p }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Games: { id, date, winner1, winner2 (player ids), winner1Name, winner2Name }
export async function getGames(players) {
  players = players || await getPlayers();
  const names = Object.fromEntries(players.map(p => [p.id, p.name]));
  return (await readMap('games'))
    .map(g => ({ ...g, winner1Name: names[g.winner1] || '?', winner2Name: g.winner2 ? (names[g.winner2] || '?') : null }))
    .sort((a, b) => dateKey(a.date).localeCompare(dateKey(b.date)));
}

// Hall of Fame: { id, playerId, name, date, hand }
export async function getHof(players) {
  players = players || await getPlayers();
  const names = Object.fromEntries(players.map(p => [p.id, p.name]));
  return (await readMap('hall_of_fame'))
    .map(h => ({ ...h, name: names[h.playerId] || '?' }))
    .sort((a, b) => dateKey(b.date).localeCompare(dateKey(a.date)));
}

// ---- writes (admin only, enforced by rules) --------------------------------
// Save (create or update) a player. `avatar`: undefined = keep, null = remove, string = data URL.
export async function savePlayer({ id, name, bio, avatar }) {
  name = (name || '').trim();
  if (!name) throw new Error('Player name is required.');
  const players = await readMap('players');
  if (players.some(p => p.id !== id && p.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('Player already exists.');
  }
  const pid = id || push(node('players')).key;
  const data = { name, bio: (bio || '').trim() };
  if (avatar !== undefined) data.avatar = avatar; // null removes the key
  await update(node('players', pid), data);
  return pid;
}

export async function addGame({ date, winner1, winner2 }) {
  if (!date || !winner1) throw new Error('Date and 1st place winner are required.');
  if (!DATE_RE.test(date)) throw new Error('Date must be in format DD/MM/YYYY.');
  await set(push(node('games')), { date, winner1, winner2: winner2 || null });
}

export async function deleteGame(id) {
  await remove(node('games', id));
}

export async function addHof({ playerId, date, hand }) {
  if (!playerId || !date || !hand) throw new Error('Player, date and hand are required.');
  if (!DATE_RE.test(date)) throw new Error('Date must be in format DD/MM/YYYY.');
  await set(push(node('hall_of_fame')), { playerId, date, hand });
}

export async function deleteHof(id) {
  await remove(node('hall_of_fame', id));
}

// Center-crops an image File to a square and returns a small JPEG data URL.
export function resizeAvatar(file, size = 256) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      canvas.getContext('2d').drawImage(
        img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => reject(new Error('Could not read image.'));
    img.src = URL.createObjectURL(file);
  });
}

// ---- auth ----------------------------------------------------------------
export const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const logout = () => signOut(auth);
export const currentUser = () => auth.currentUser;

// Resolves with the current user (or null) once Firebase has restored the session.
export const whenAuthReady = () => new Promise(resolve => {
  const unsub = onAuthStateChanged(auth, user => { unsub(); resolve(user); });
});

// True when the signed-in user is listed under vibe-poker/admins/<uid>.
export async function isAdmin(user) {
  if (!user) return false;
  try {
    return (await get(node('admins', user.uid))).val() === true;
  } catch {
    return false;
  }
}
