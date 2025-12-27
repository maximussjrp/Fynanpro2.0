const bcrypt = require("bcrypt");
const hash = bcrypt.hashSync("Max@1234", 10);
console.log(hash);
