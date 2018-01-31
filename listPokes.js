const { MongoClient } = require('mongodb');

(async function () {
  const client = await MongoClient.connect('mongodb://localhost:27017');
  const db = client.db('pokedex');

  const pokemon = db.collection('pokemon');

  const sample = await pokemon.find().limit(5).toArray();
  console.log(JSON.stringify(sample));
  client.close();
}());
