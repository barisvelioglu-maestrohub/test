'use strict';
/* Ashen Crowns — static game data. Everything here is original to this project. */

const TILE = 16, SCALE = 3, TS = TILE * SCALE;
const MAP_W = 44, MAP_H = 32, MAX_STACK = 8, MAP_SEED = 90417;
const MAP_NAME = 'The Sundered Vale';

const FACTIONS = [
  { name: 'Sunmarch Compact', short: 'Sunmarch', color: '#c9a03a', dark: '#6f5216', capital: 'Auremont',
    special: 'rider', heroCls: 'champion', blurb: 'Plains lords with swift lancers and deep coffers.',
    heroes: ['Ser Aldous Vane', 'Marta of the Reeds', 'Corwin Hale', 'Dame Isolde Farrow'] },
  { name: 'Thornwild Kindred', short: 'Thornwild', color: '#4f9257', dark: '#234f2d', capital: 'Eldbough',
    special: 'warden', heroCls: 'seer', blurb: 'Forest folk whose wardens strike from the trees.',
    heroes: ['Ysolde Greenmantle', 'Fenn Ashroot', 'Lirael Mossgrave', 'Old Tam Bracken'] },
  { name: 'Cinderhold Clans', short: 'Cinderhold', color: '#b34a36', dark: '#662016', capital: 'Brazenhearth',
    special: 'reaver', heroCls: 'champion', blurb: 'Hill clans. Slow, stubborn and very hard to kill.',
    heroes: ['Brakka Stonejaw', 'Hildr Emberbraid', 'Dorn Ironkettle', 'Ragna Coalhand'] },
  { name: 'Veilmere Court', short: 'Veilmere', color: '#7d68b3', dark: '#3f2f72', capital: 'Nocthaven',
    special: 'gryphon', heroCls: 'seer', blurb: 'Sorcerer-princes who rule the sky on gryphon wings.',
    heroes: ['Maelis the Pale', 'Prince Orrin Veil', 'Sabeth Nightwell', 'Calix Duskmere'] },
];
const NEUTRAL = { name: 'Free Cities', short: 'Free', color: '#a8a394', dark: '#5f5b50' };

/* str = battle strength, hp = hits it can take, mv = movement points, turns = build time */
const UNITS = {
  levy:    { name: 'Levy',            str: 2, hp: 2, mv: 10, cost: 20,  turns: 1, abil: [] },
  pike:    { name: 'Pikemen',         str: 3, hp: 2, mv: 10, cost: 35,  turns: 1, abil: ['guard'] },
  archer:  { name: 'Longbows',        str: 3, hp: 2, mv: 11, cost: 45,  turns: 2, abil: ['volley'] },
  wolf:    { name: 'Wolf Pack',       str: 3, hp: 2, mv: 16, cost: 40,  turns: 1, abil: ['forester'] },
  rider:   { name: 'Lancers',         str: 4, hp: 2, mv: 18, cost: 60,  turns: 2, abil: [] },
  warden:  { name: 'Thorn Wardens',   str: 4, hp: 2, mv: 12, cost: 65,  turns: 2, abil: ['forester', 'volley'] },
  reaver:  { name: 'Hill Reavers',    str: 5, hp: 3, mv: 9,  cost: 80,  turns: 3, abil: ['hillfolk'] },
  ram:     { name: 'Ram Crew',        str: 2, hp: 3, mv: 8,  cost: 70,  turns: 3, abil: ['siege'] },
  bearer:  { name: 'Standard Bearer', str: 2, hp: 2, mv: 12, cost: 80,  turns: 3, abil: ['banner'] },
  gryphon: { name: 'Gryphon',         str: 5, hp: 3, mv: 18, cost: 130, turns: 4, abil: ['flying'] },
  troll:   { name: 'Bog Troll',       str: 6, hp: 4, mv: 8,  cost: 120, turns: 4, abil: [] },
  drake:   { name: 'Ember Drake',     str: 8, hp: 4, mv: 16, cost: 250, turns: 6, abil: ['flying', 'terror'] },
  champion:{ name: 'Champion',        str: 5, hp: 4, mv: 14, cost: 0,   turns: 0, abil: [], hero: true, mana: 8 },
  seer:    { name: 'Seer',            str: 3, hp: 3, mv: 14, cost: 0,   turns: 0, abil: [], hero: true, mana: 16 },
};

const ABILITIES = {
  guard:    'Guard: +1 when defending a city',
  volley:   'Volley: 30% chance of a free hit before each duel',
  forester: 'Forester: moves freely through forest, +1 fighting there',
  hillfolk: 'Hillfolk: moves freely through hills, +1 fighting there',
  siege:    'Siege: cancels up to 2 points of city walls',
  banner:   'Banner: +1 to every unit in its army',
  flying:   'Flying: crosses water, mountains and all terrain',
  terror:   'Terror: -1 to every enemy unit in battle',
};

const ITEMS = [
  { key: 'blade',  name: 'Blade of First Light', desc: '+2 strength', str: 2 },
  { key: 'horn',   name: "Marshal's Horn",       desc: '+1 command (whole army)', lead: 1 },
  { key: 'boots',  name: 'Windstep Boots',       desc: '+6 movement', mv: 6 },
  { key: 'ring',   name: 'Tithe Ring',           desc: '+15 gold each turn', gold: 15 },
  { key: 'shield', name: 'Oakheart Shield',      desc: '+1 strength, +1 hit', str: 1, hp: 1 },
  { key: 'phial',  name: 'Star Phial',           desc: '+8 maximum mana', mana: 8 },
  { key: 'crown',  name: 'Circlet of Ash',       desc: '+1 command, +1 strength', lead: 1, str: 1 },
];

/* Advances a hero picks from on gaining a level. Each class is offered a different pair per level. */
const PERKS = {
  str:  { name: 'Might',       desc: '+1 strength' },
  hp:   { name: 'Vigour',      desc: '+1 hit' },
  lead: { name: 'Command',     desc: '+1 strength for the whole army' },
  mv:   { name: 'Pathfinding', desc: '+4 movement' },
  mana: { name: 'Lore',        desc: '+6 mana' },
};
const PERK_CHOICES = {
  champion: [['str', 'hp'], ['lead', 'str'], ['hp', 'mv'], ['str', 'lead']],
  seer:     [['mana', 'str'], ['lead', 'mana'], ['str', 'mv'], ['lead', 'hp']],
};

const SPELLS = [
  { key: 'march', name: 'Quickmarch', cost: 4, desc: '+6 movement for the whole army this turn' },
  { key: 'ward',  name: 'Warding',    cost: 5, desc: '+1 strength for the whole army until your next turn' },
  { key: 'pack',  name: 'Call the Pack', cost: 8, desc: 'A wolf pack joins the army' },
];

const CITY_NAMES = ['Pellwick', 'Dunmarrow', 'Ostrel', 'Greywater', 'Fennick', 'Calder Ford', 'Mirebank',
  'Highcairn', 'Wend', 'Saltreach', 'Brackmoor', 'Tollen', 'Ashby Cross', 'Lantern Hill', 'Quillhaven', 'Rookfall'];
const RUIN_NAMES = ['Sunken Cloister', 'Hollow Barrow', 'Shattered Observatory', "Wyrm's Rest", 'Drowned Chapel',
  'Thorn Vault', 'Cairn of Echoes', "Old King's Cistern", 'Mossback Keep', 'The Ninth Stair'];

const TERRAIN_NAMES = { g: 'Grassland', f: 'Forest', h: 'Hills', m: 'Mountains', w: 'Water', s: 'Marsh' };
