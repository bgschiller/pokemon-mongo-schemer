const { MongoClient } = require('mongodb');
const pokes = require('./pokemon.json');
const schema = require('./schema.js');

process.on('unhandledRejection', (error) => console.error('unhandled', error));
(async function() {
  const client = await MongoClient.connect('mongodb://localhost:27017');
  const db = client.db('pokedex');
  db.createCollection(
    'pokemon',
    { validator: {
        $jsonSchema: schema,
      },
    });
  const pokemon = db.collection('pokemon');
  try {
    console.log('gonna insert the first pokemon');
    const response = await pokemon.insertOne(pokes[0]);
  } catch (e) {
    console.error(e);
  }
  client.close();
}());
