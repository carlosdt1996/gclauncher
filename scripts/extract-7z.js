import Seven from 'node-7z';
import sevenBin from '7zip-bin';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const archivePath = path.join(__dirname, '../7z-extra.7z');
const outputDir = path.join(__dirname, '../electron/bin/7z');
const pathTo7zip = sevenBin.path7za;

console.log(`Extracting ${archivePath} to ${outputDir}...`);

const myStream = Seven.extractFull(archivePath, outputDir, {
    $bin: pathTo7zip,
    $progress: true
});

myStream.on('end', () => console.log('Extraction complete!'));
myStream.on('error', (err) => console.error('Error:', err));
