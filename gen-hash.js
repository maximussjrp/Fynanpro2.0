const bcrypt = require('bcryptjs');

async function main() {
  const hash = await bcrypt.hash('Test123!', 12);
  console.log('HASH:', hash);
}

main();
