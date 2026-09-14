import db from './index.js';

const sampleItems = ['First item', 'Second item', 'Third item'];

const insert = db.prepare('INSERT INTO items (name) VALUES (?)');
for (const name of sampleItems) {
  insert.run(name);
}

console.log(`Seeded ${sampleItems.length} items.`);
