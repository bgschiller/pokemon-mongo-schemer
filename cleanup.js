const { MongoClient } = require('mongodb');

(async function () {
  const client = await MongoClient.connect('mongodb://localhost:27017');
  const db = client.db('pokedex');

  await db.collection('pokemon').drop();
  client.close();
}());
