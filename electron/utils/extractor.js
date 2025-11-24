import Seven from 'node-7z';
import sevenBin from '7zip-bin';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Try to find UnRAR/WinRAR CLI tools
// Returns the path to UnRAR.exe or Rar.exe if found, null otherwise
function findUnRAR() {
    const winrarPaths = [
        // UnRAR.exe (extraction only, preferred for our use case)
        'C:\\Program Files\\WinRAR\\UnRAR.exe',
        'C:\\Program Files (x86)\\WinRAR\\UnRAR.exe',
        path.join(process.env.ProgramFiles || 'C:\\Program Files', 'WinRAR', 'UnRAR.exe'),
        path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'WinRAR', 'UnRAR.exe'),
        // Rar.exe (full version with compression)
        'C:\\Program Files\\WinRAR\\Rar.exe',
        'C:\\Program Files (x86)\\WinRAR\\Rar.exe',
        path.join(process.env.ProgramFiles || 'C:\\Program Files', 'WinRAR', 'Rar.exe'),
        path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'WinRAR', 'Rar.exe')
    ];

    for (const winrarPath of winrarPaths) {
        if (fs.existsSync(winrarPath)) {
            return winrarPath;
        }
    }

    return null;
}

// Try to find the best extraction tool
// Priority: WinRAR CLI (best RAR support) > 7-Zip (good RAR5 support) > bundled 7za.exe (limited RAR support)
function find7zipBinary() {
    console.log('[Extractor] Searching for extraction tools...');

    // 1. Try WinRAR command-line tools first (has the best RAR support including RAR5)
    // Note: We need Rar.exe or UnRAR.exe, NOT WinRAR.exe (which is the GUI)
    const unrarPath = findUnRAR();
    if (unrarPath) {
        console.log('[Extractor] ✅ Using WinRAR CLI (best RAR support):', unrarPath);
        return unrarPath;
    }

    // 2. Try system-installed 7-Zip (has good RAR5 support)
    const sevenZipPaths = [
        'C:\\Program Files\\7-Zip\\7z.exe',
        'C:\\Program Files (x86)\\7-Zip\\7z.exe',
        path.join(process.env.ProgramFiles || 'C:\\Program Files', '7-Zip', '7z.exe'),
        path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', '7-Zip', '7z.exe')
    ];

    for (const sevenZipPath of sevenZipPaths) {
        if (fs.existsSync(sevenZipPath)) {
            console.log('[Extractor] ✅ Using 7-Zip (good RAR5 support):', sevenZipPath);
            return sevenZipPath;
        }
    }

    // 3. Try bundled 7za from our custom bin folder
    const customBinPath = path.join(__dirname, '..', 'bin', '7z', 'x64', '7za.exe');
    if (fs.existsSync(customBinPath)) {
        console.log('[Extractor] ⚠️ Using bundled 7za (x64):', customBinPath);
        console.warn('[Extractor] WARNING: 7za.exe has limited RAR support. RAR5 archives may fail.');
        console.warn('[Extractor] RECOMMENDATION: Install WinRAR or 7-Zip for better compatibility.');
        return customBinPath;
    }

    // 4. Try bundled 7za from our custom bin folder (32-bit)
    const customBinPath32 = path.join(__dirname, '..', 'bin', '7z', '7za.exe');
    if (fs.existsSync(customBinPath32)) {
        console.log('[Extractor] ⚠️ Using bundled 7za (32-bit):', customBinPath32);
        console.warn('[Extractor] WARNING: 7za.exe has limited RAR support. RAR5 archives may fail.');
        console.warn('[Extractor] RECOMMENDATION: Install WinRAR or 7-Zip for better compatibility.');
        return customBinPath32;
    }

    // 5. Fall back to 7zip-bin package
    console.log('[Extractor] ⚠️ Using 7zip-bin package:', sevenBin.path7za);
    console.warn('[Extractor] WARNING: 7za.exe has limited RAR support. RAR5 archives may fail.');
    console.warn('[Extractor] RECOMMENDATION: Install WinRAR or 7-Zip for better compatibility.');
    return sevenBin.path7za;
}

// Get the path to the extraction binary
const pathTo7zip = find7zipBinary();

/**
 * Validate that a file is a valid archive before extraction
 */
async function validateArchive(archivePath) {
    return new Promise((resolve, reject) => {
        // Check if file exists
        if (!fs.existsSync(archivePath)) {
            reject(new Error('Archive file does not exist'));
            return;
        }

        // Check file size (should be > 0)
        const stats = fs.statSync(archivePath);
        if (stats.size === 0) {
            reject(new Error('Archive file is empty or incomplete'));
            return;
        }

        // Try to list archive contents to validate it's a valid archive
        const listStream = Seven.list(archivePath, {
            $bin: pathTo7zip
        });

        let hasValidEntry = false;

        listStream.on('data', (data) => {
            // If we get any data, the archive is valid
            hasValidEntry = true;
        });

        listStream.on('end', () => {
            if (hasValidEntry) {
                resolve(true);
            } else {
                reject(new Error('Archive appears to be empty or invalid'));
            }
        });

        listStream.on('error', (err) => {
            // Check if error is about not being able to open as archive
            const errorMsg = err.message || err.toString();
            if (errorMsg.includes('Cannot open the file as archive') ||
                errorMsg.includes('not supported archive') ||
                errorMsg.includes('is not archive')) {
                reject(new Error('File cannot be opened as archive. It may be corrupted, incomplete, or not a valid archive format.'));
            } else {
                reject(new Error(`Archive validation failed: ${errorMsg}`));
            }
        });
    });
}

/**
 * Extract using UnRAR directly (node-7z doesn't work well with UnRAR)
 */
async function extractWithUnRAR(unrarPath, archivePath, outputDir, onProgress) {
    return new Promise((resolve, reject) => {

        console.log('[Extractor] Using UnRAR with command: x -o+ -y');
        console.log('[Extractor] Archive:', archivePath);
        console.log('[Extractor] Output:', outputDir);

        // UnRAR command: x = extract with full path, -o+ = overwrite, -y = assume yes
        const unrar = spawn(unrarPath, ['x', '-o+', '-y', archivePath, outputDir]);

        let output = '';
        let errorOutput = '';
        let lastProgress = 0;

        unrar.stdout.on('data', (data) => {
            const text = data.toString();
            output += text;
            console.log('[UnRAR]', text.trim());

            // Try to parse progress from UnRAR output
            // UnRAR shows progress like: "Extracting  filename.ext  50%"
            const progressMatch = text.match(/(\d+)%/);
            if (progressMatch && onProgress) {
                const percent = parseInt(progressMatch[1]);
                if (percent !== lastProgress) {
                    lastProgress = percent;
                    onProgress({ percent, file: 'extracting...' });
                }
            }
        });

        unrar.stderr.on('data', (data) => {
            const text = data.toString();
            errorOutput += text;
            console.error('[UnRAR Error]', text.trim());
        });

        unrar.on('close', (code) => {
            console.log('[UnRAR] Process exited with code:', code);

            if (code === 0) {
                console.log('[Extractor] UnRAR extraction successful');
                resolve(outputDir);
            } else {
                const errorMsg = errorOutput || output || 'Unknown error';
                console.error('[Extractor] UnRAR failed:', errorMsg);

                // Check for common errors
                if (errorMsg.includes('CRC failed') || errorMsg.includes('checksum error')) {
                    reject(new Error('Archive is corrupted or incomplete. CRC check failed.'));
                } else if (errorMsg.includes('password')) {
                    reject(new Error('Archive is password protected.'));
                } else if (errorMsg.includes('not RAR archive')) {
                    reject(new Error('File is not a valid RAR archive.'));
                } else {
                    reject(new Error(`UnRAR extraction failed: ${errorMsg}`));
                }
            }
        });

        unrar.on('error', (err) => {
            console.error('[UnRAR] Spawn error:', err);
            reject(new Error(`Failed to start UnRAR: ${err.message}`));
        });
    });
}

export function extractArchive(archivePath, outputDir, onProgress) {
    return new Promise(async (resolve, reject) => {
        // Normalize paths to handle special characters and ensure absolute paths
        const normalizedArchivePath = path.resolve(archivePath);
        const normalizedOutputDir = path.resolve(outputDir || path.dirname(normalizedArchivePath));

        console.log(`[Extractor] ========================================`);
        console.log(`[Extractor] Starting extraction process`);
        console.log(`[Extractor] Archive path: ${normalizedArchivePath}`);
        console.log(`[Extractor] Output directory: ${normalizedOutputDir}`);
        console.log(`[Extractor] Archive file extension: ${path.extname(normalizedArchivePath)}`);

        // Check if archive file exists
        if (!fs.existsSync(normalizedArchivePath)) {
            const error = `Archive file not found: ${normalizedArchivePath}`;
            console.error(`[Extractor] ${error}`);
            reject(new Error(error));
            return;
        }

        // Check file size and validate it's not empty
        let stats = fs.statSync(normalizedArchivePath);
        const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);
        console.log(`[Extractor] Archive file size: ${fileSizeMB} MB`);

        if (stats.size === 0) {
            const error = 'Archive file is empty (0 bytes). The download may not have completed.';
            console.error(`[Extractor] ${error}`);
            reject(new Error(error));
            return;
        }

        // Wait a moment to ensure file is completely written and file handles are released
        // This is especially important for files that were just downloaded
        console.log('[Extractor] Waiting 2 seconds to ensure file is ready...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Re-check file size to ensure it's not still being written
        const newStats = fs.statSync(normalizedArchivePath);
        if (newStats.size !== stats.size) {
            const error = 'Archive file is still being written. Please wait for download to complete.';
            console.error(`[Extractor] ${error} (size changed from ${stats.size} to ${newStats.size})`);
            reject(new Error(error));
            return;
        }

        console.log('[Extractor] File validation passed');

        // Ensure output directory exists
        if (!fs.existsSync(normalizedOutputDir)) {
            fs.mkdirSync(normalizedOutputDir, { recursive: true });
        }

        // Check if this is a RAR file and if we have UnRAR
        const isRarFile = path.extname(normalizedArchivePath).toLowerCase() === '.rar';
        const unrarPath = findUnRAR();

        if (isRarFile && unrarPath) {
            console.log('[Extractor] Using UnRAR for RAR file');
            try {
                await extractWithUnRAR(unrarPath, normalizedArchivePath, normalizedOutputDir, onProgress);

                // Verify extraction by checking if files were created
                try {
                    const files = fs.readdirSync(normalizedOutputDir);
                    const extractedFiles = files.filter(f => f !== path.basename(normalizedArchivePath));
                    console.log(`[Extractor] Extracted ${extractedFiles.length} items`);
                    if (extractedFiles.length === 0) {
                        console.warn('[Extractor] Warning: No new files found in output directory after extraction');
                    }
                } catch (err) {
                    console.error('[Extractor] Error reading output directory:', err);
                }

                resolve(normalizedOutputDir);
                return;
            } catch (error) {
                console.error('[Extractor] UnRAR extraction failed:', error);
                reject(error);
                return;
            }
        }

        // Fall back to 7-Zip for non-RAR files or if UnRAR not available
        console.log('[Extractor] Using 7-Zip/7za for extraction');

        // Check if this is a multi-part RAR archive
        const isMultiPartRar = /\.part\d+\.rar$/i.test(normalizedArchivePath) ||
            /\.r\d+$/i.test(normalizedArchivePath);

        if (isMultiPartRar) {
            console.log('[Extractor] Detected multi-part RAR archive');
        }

        // Use normalized paths for extraction
        // For RAR files, especially multi-part ones, use specific options
        const extractOptions = {
            $bin: pathTo7zip,
            $progress: true,
            recursive: true,
            // For RAR files, ensure we handle all parts
            yes: true, // Assume yes on all queries
            overwrite: 'a' // Overwrite all existing files
        };

        console.log('[Extractor] Starting extraction with options:', extractOptions);

        const myStream = Seven.extractFull(normalizedArchivePath, normalizedOutputDir, extractOptions);

        let hasProgress = false;

        myStream.on('progress', (progress) => {
            hasProgress = true;
            // progress is an object: { percent: 10, fileCount: 5, file: 'something.txt' }
            console.log(`[Extractor] Progress: ${progress.percent}% - ${progress.file || 'extracting...'}`);
            if (onProgress) {
                onProgress(progress);
            }
        });

        myStream.on('end', () => {
            console.log('[Extractor] Extraction complete');
            console.log(`[Extractor] Output directory: ${normalizedOutputDir}`);

            // Verify extraction by checking if files were created
            try {
                const files = fs.readdirSync(normalizedOutputDir);
                console.log(`[Extractor] Extracted ${files.length} items`);
                if (files.length === 0) {
                    console.warn('[Extractor] Warning: No files found in output directory after extraction');
                }
            } catch (err) {
                console.error('[Extractor] Error reading output directory:', err);
            }

            resolve(normalizedOutputDir);
        });

        myStream.on('error', (err) => {
            console.error('[Extractor] Error:', err);
            console.error('[Extractor] Error details:', {
                message: err.message,
                stack: err.stack,
                hasProgress: hasProgress,
                archivePath: normalizedArchivePath,
                isRarFile: path.extname(normalizedArchivePath).toLowerCase() === '.rar'
            });

            const errorMsg = err.message || err.toString();
            const isRarFile = path.extname(normalizedArchivePath).toLowerCase() === '.rar';

            // Provide more helpful error messages
            if (errorMsg.includes('Cannot open the file as archive') ||
                errorMsg.includes('Unsupported archive') ||
                errorMsg.includes('is not supported archive') ||
                // node-7z sometimes returns the filepath as error if it fails to parse stderr correctly
                // but usually this happens when 7zip says "Cannot open..."
                (errorMsg.includes(normalizedArchivePath) && !errorMsg.includes('Exit code'))) {

                // Special handling for RAR files - likely RAR5 format issue
                if (isRarFile) {
                    const rar5Message = 'Cannot extract RAR archive. This is likely a RAR5 format file which requires WinRAR or 7-Zip.\n\n' +
                        'SOLUTION (choose one):\n\n' +
                        'Option 1 - WinRAR (Recommended for RAR files):\n' +
                        '1. Download WinRAR from: https://www.win-rar.com/download.html\n' +
                        '2. Install it to the default location\n' +
                        '3. Restart this application and try again\n\n' +
                        'Option 2 - 7-Zip (Free alternative):\n' +
                        '1. Download 7-Zip from: https://www.7-zip.org/\n' +
                        '2. Install it to the default location (C:\\Program Files\\7-Zip\\)\n' +
                        '3. Restart this application and try again\n\n' +
                        'Alternatively, the file may be corrupted or incomplete.';
                    reject(new Error(rar5Message));
                } else {
                    reject(new Error('Cannot open the file as archive. The file may be corrupted, incomplete, or not a valid archive. Please check if the download completed successfully.'));
                }
            } else if (errorMsg.includes('not supported archive')) {
                reject(new Error('Archive format is not supported or the file is corrupted.'));
            } else if (errorMsg.includes('Wrong password')) {
                reject(new Error('Archive is password protected.'));
            } else if (errorMsg.includes('CRC failed') || errorMsg.includes('Data error')) {
                reject(new Error('Archive is corrupted or incomplete. CRC check failed.'));
            } else {
                reject(new Error(`Extraction failed: ${errorMsg}`));
            }
        });
    });
}

export function isArchive(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return ['.zip', '.rar', '.7z', '.tar', '.gz'].includes(ext);
}

/**
 * Find the main archive file in a directory
 * Prioritizes .rar files, handles multi-part archives, and ignores samples
 */
export function findMainArchive(directoryPath) {
    console.log('[findMainArchive] Searching in directory:', directoryPath);

    if (!fs.existsSync(directoryPath)) {
        console.log('[findMainArchive] Directory does not exist');
        return null;
    }

    const files = fs.readdirSync(directoryPath);
    console.log('[findMainArchive] Total files in directory:', files.length);

    const archives = files.filter(f => isArchive(f));
    console.log('[findMainArchive] Archive files found:', archives.length, archives);

    if (archives.length === 0) return null;

    // Filter out samples
    const noSamples = archives.filter(f => !f.toLowerCase().includes('sample'));
    console.log('[findMainArchive] Archives after filtering samples:', noSamples.length);

    if (noSamples.length === 0) return null; // Only samples found?

    // 1. Look for .rar files first (most common for scene releases)
    const rarFiles = noSamples.filter(f => path.extname(f).toLowerCase() === '.rar');
    console.log('[findMainArchive] RAR files found:', rarFiles.length, rarFiles);

    if (rarFiles.length > 0) {
        // Check for multi-part archives with various naming conventions

        // Pattern 1: part01.rar, part001.rar, part0001.rar
        const part1Patterns = [
            /\.part0*1\.rar$/i,
            /\.part0*1$/i
        ];

        for (const pattern of part1Patterns) {
            const part1 = rarFiles.find(f => pattern.test(f));
            if (part1) {
                const fullPath = path.join(directoryPath, part1);
                console.log('[findMainArchive] Found multi-part RAR (part01 style):', part1);
                return fullPath;
            }
        }

        // Pattern 2: Old style multi-part (.rar, .r00, .r01, .r02, etc.)
        // The main file is usually just .rar, and parts are .r00, .r01, etc.
        const hasOldStyleParts = files.some(f => /\.r\d{2,3}$/i.test(f));
        if (hasOldStyleParts) {
            const mainRar = rarFiles.find(f => /\.rar$/i.test(f) && !/\.part\d+\.rar$/i.test(f));
            if (mainRar) {
                const fullPath = path.join(directoryPath, mainRar);
                console.log('[findMainArchive] Found multi-part RAR (old .r00 style):', mainRar);
                return fullPath;
            }
        }

        // If there are multiple .rar files and no "part1", pick the largest one or the first one?
        // Usually there's only one main .rar in a scene release folder

        // Sort by size (largest first) to avoid small extras
        rarFiles.sort((a, b) => {
            const statA = fs.statSync(path.join(directoryPath, a));
            const statB = fs.statSync(path.join(directoryPath, b));
            return statB.size - statA.size;
        });

        const selectedRar = path.join(directoryPath, rarFiles[0]);
        console.log('[findMainArchive] Selected RAR file (largest):', rarFiles[0]);
        return selectedRar;
    }

    // 2. If no rar, look for other archives
    console.log('[findMainArchive] No RAR files, checking other archive types');

    // Sort by size
    noSamples.sort((a, b) => {
        const statA = fs.statSync(path.join(directoryPath, a));
        const statB = fs.statSync(path.join(directoryPath, b));
        return statB.size - statA.size;
    });

    const selectedArchive = path.join(directoryPath, noSamples[0]);
    console.log('[findMainArchive] Selected archive file (largest):', noSamples[0]);
    return selectedArchive;
}
