module.exports = {
  type: "object",
  definitions: {
    Stat: {
      type: "number",
      minimum: 0,
      maximum: 255,
    },
  },
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
};