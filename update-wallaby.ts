console.log('Wallaby updater');

import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as path from 'path';
import * as stream from 'stream';
import * as util from 'util';

function fetch(url: string): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    https
      .get(url, res => {
        res.once('error', error => {
          reject(error);
        });

        res.once('readable', () => {
          resolve(res);
        });
      })
      .once('error', error => {
        reject(error);
      });
  });
}

async function main() {
  const checkVersion = await fetch('https://s3.amazonaws.com/wallaby-downloads/wallaby.json');

  const body = checkVersion.read().toString();
  const wallaby = JSON.parse(body);

  const file = `wallaby-v${wallaby.latestServer[0]}.zip`;
  const readdir = util.promisify(fs.readdir);
  const extensions = path.join(process.env.USERPROFILE || '', '.vscode/extensions/');
  const files = await readdir(extensions);
  const wallabyFolders = files.filter(f => /wallabyjs\.wallaby-vscode-/i.test(f));
  if (wallabyFolders.length === 0) {
    throw new Error('Missing WallabyJs VS Code extension');
  }
  console.log('Using VS Code', wallabyFolders[0], 'extension folder');

  const wallabyFolder = path.join(process.env.USERPROFILE || '', '.vscode/extensions', wallabyFolders[0]);
  const wallabyFile = path.join(wallabyFolder, `${file}`);

  const exists = util.promisify(fs.exists);

  if (!await exists(wallabyFile)) {
    console.log('downloading wallaby version', wallaby.latestServer[0]);

    const bin = await fetch(`https://s3.amazonaws.com/wallaby-downloads/${file}`);

    const output = fs.createWriteStream(wallabyFile);

    await new Promise(resolve => {
      bin
        .once('end', () => {
          resolve();
        })
        .pipe(output);
    });
  }

  const exec = util.promisify(childProcess.exec);
  console.log('Unzipping', wallabyFile);

  const unzipOperation = childProcess.spawn(`unzip`, [
    '-u',
    '-o',
    wallabyFile,
    '-d',
    path.join(wallabyFolder, 'wallaby')
  ]);

  unzipOperation.stdout.pipe(process.stdout);
  unzipOperation.stderr.pipe(process.stderr);

  await new Promise((resolve, reject) => {
    unzipOperation
      .once('error', error => {
        console.log('Unzip error', error);

        reject(error);
      })
      .once('exit', code => {
        console.log('Unzip exit code', code);

        resolve(code);
      });
  });

  console.log('Done');
}

main().catch(e => console.error(e.message, e));
