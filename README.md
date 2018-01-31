Mongo Schemas with Pokemon
==========================

*Cross-posted to my blog at https://brianschiller.com/blog/2018/01/30/pokemon-mongo-schemer

Okay, so we're trying organize our pokemon. Build up our own little pokedex, if you will. And we're gonna use Mongodb because we gotta be web-scale; who *knows* how many pokemon there could be (I lost track after the first 151).

But we're not just gonna throw pokemon into mongo in a jumble! I said we were trying to *organize* the pokemon. We'll need a schema. Luckily, we're using MongoDB version 3.6, which supports JSON Schema.

The code at each step is available as the sequence of commits in this repo. Check out the [commit listing](https://github.com/bgschiller/pokemon-mongo-schemer/commits/master) to jump around.

Let's get started. I'm looking at [pokemon.json](./pokemon.json), which is based on [ATL-WDI-Exercises/mongo-pokemon](https://github.com/ATL-WDI-Exercises/mongo-pokemon). I've added a few errors so that we can stress-test our schema. We don't want to let Gary pull a fast one on us by adding some pokemon that breaks the rules!

Here's our schema to begin with.

```json
{
  type: "object",
  properties: {
    element: {
      type: "array",
      items: {
        type: "string",
        enum: [
          // probably there are more, but maybe we've only seen
          // the starters so far!
          "Grass",
          "Poison",
          "Fire",
          "Water",
        ],
      },
    },
    stats: {
      type: "object",
    },
    misc: {
      type: "object",
      properties: {
        sex_ratios: {
          type: "object",
        },
        classification: { type: "string" },
        // and some other properties...
      },
      additionalProperties: true,
    },
  },
  // we'll turn this off this later to make our schema more strict.
  // for now, it lets us get away with loading a partial schema.
  additionalProperties: true,
}
```
Let's try it out with just one pokemon to start with. We'll use the following node script.

```javascript
const { MongoClient } = require('mongodb');
const pokes = require('./pokemon.json');
const schema = require('./schema.json');

(async function () {
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
```

Okay, so far so good. Now we have a bit of confidence that our schema at least didn't crash things. We can check that Bulbasaur was indeed added using the `mongo` shell.

## Good documents succeed; bad docs are the true test

Is our schema even doing anything? Let's try adding something nonsense, to make sure.

```javascript
// ...
 const response = await pokemon.insertOne({
   name: "Norberta",
   element: [
     "Flying",
     "Norwegian Ridge-back",
   ],
   stats: "no thanks",
 });
// ...
```

Okay, if your setup is working, that should give you an error message: "Document failed validation". Sooo, our schema is (maybe?) working. But Mongo is not exactly forthcoming about what the issue is.

Luckily, because JSON Schema is a standard, we can use another tool to tell us what's wrong. There's a great schema validator called [ajv](https://github.com/epoberezkin/ajv). Using the command line interface illustrates our problem:

```bash
$ ajv -s schema.json -d norberta.json --errors=text --all-errors
norberta.json invalid
data.element[0] should be equal to one of the allowed values
data.element[1] should be equal to one of the allowed values
data.stats should be object
```

Alright! That's a little more useful. It would be nice if we could get errors like that from mongo when validation fails. We would need to:

1. Catch errors occuring from `insert`, `insertMany`, `update`, and `updateMany` operations.
2. Pull the schema from the collection.
3. Convert some mongo-specific schema entries into things `ajv` will understand (eg, `bsonType`, `ObjectID`, `date`).
4. Figure out which document was failing validation (in the `*Many` cases).
5. For an update, synthesize the document that *would have been created* if the operation had succeeded.

## mongo-schemer enters, stage right

Actually, all that hard work is already done! At [devetry](https://devetry.com/), we made and open-sourced a library to do just that: [mongo-schemer](https://github.com/devetry/mongo-schemer). Let's add it to our script.

```javascript
const MongoSchemer = require('mongo-schemer');
// ...
const db = MongoSchemer.explainSchemaErrors(
  client.db('pokedex'), {
    onError: (errors) => console.error(errors),
  });
// ...
```

Now let's run our Norberta script again. This time, it reports on the errors:

```json
[ { keyword: 'enum',
    dataPath: '.element[0]',
    schemaPath: '#/properties/element/items/enum',
    params: { allowedValues: [Array] },
    message: 'should be equal to one of the allowed values' },
  { keyword: 'enum',
    dataPath: '.element[1]',
    schemaPath: '#/properties/element/items/enum',
    params: { allowedValues: [Array] },
    message: 'should be equal to one of the allowed values' },
  { keyword: 'type',
    dataPath: '.stats',
    schemaPath: '#/properties/stats/type',
    params: { type: 'object' },
    message: 'should be object' } ]
```

## Stricter Schema: stats

We're now confident that the schema is truly guarding our collection. Let's make it a bit more strict. How about starting with that `stats` property. A stat is a number between 0 and 255. We can define a "Stat" in our schema to mean just that. Each pokemon should have one for `hp`, `attack`, `defense`, `spattack`, `spdefense`, and `speed`.

```javascript
// ...
  definitions: {
    Stat: {
      type: "number",
      minimum: 0,
      maximum: 255,
    },
// ...
  stats: {
    type: "object",
    properties: {
      hp: { $ref: "#/definitions/Stat" },
      attack: { $ref: "#/definitions/Stat" },
      defense: { $ref: "#/definitions/Stat" },
      spattack: { $ref: "#/definitions/Stat" },
      spdefense: { $ref: "#/definitions/Stat" },
      speed: { $ref: "#/definitions/Stat" },
    },
    additionalProperties: false,
  },
// ...
```

And when we run this... it crashes! Maybe in the future it doesn't. Right now, with version 3.6, I get "MongoError: $jsonSchema keyword 'definitions' is not currently supported". Sooo, that's a bummer.

But all is not lost! A package called [json-schema-ref-parser](https://github.com/BigstickCarpet/json-schema-ref-parser) comes to our rescue this time. It does just what it says: takes any `$ref`erences to definitions and *de*references them -- inlining the definition in each spot it's used.

```javascript
const $RefParser = require('json-schema-ref-parser');
// ...
const inlinedSchema = await $RefParser.dereference(schema);
delete inlinedSchema.definitions;
db.createCollection(
  'pokemon',
  { validator: {
      $jsonSchema: inlinedSchema,
    },
  });
// ...
```

That's more like it! Now if we run our script, we should get some errors saying things like "stats.attack should be number". Sure enough, take a look at Bulbasaur in pokemon.json: some of his stats are strings pretending to be numbers. If we fix those up, the errors go away.
