/* eslint-disable no-console */

import { Logging } from 'homebridge';

import { NavienException } from '../navien/exceptions/index.js';
import { NavienAuth } from '../navien/navien.auth.js';

if (process.argv.length < 4) {
  console.error('Usage: navien <username> <password>');
  process.exit(1);
}

async function main() {
  const username = process.argv[2];
  const password = process.argv[3];

  const auth = new NavienAuth(console as unknown as Logging);

  const response = await auth.login(username, password);
  console.log('refreshToken:', response.refreshToken);
  console.log('accountSeq:', response.userSeq);
}

main().catch((error) => {
  if (error instanceof NavienException) {
    console.error(error.toString());
    return;
  }
  console.error('Unknown error occurred. Please report this to the developer:', error);
});
