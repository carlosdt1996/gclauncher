import Seven from 'node-7z';
import sevenBin from '7zip-bin';
import path from 'path';
import fs from 'fs';

// Get the path to the 7z binary
const pathTo7zip = sevenBin.path7za;

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

export function extractArchive(archivePath, outputDir, onProgress) {
    return new Promise(async (resolve, reject) => {
        // Normalize paths to handle special characters and ensure absolute paths
        const normalizedArchivePath = path.resolve(archivePath);
        const normalizedOutputDir = path.resolve(outputDir || path.dirname(normalizedArchivePath));
        
        console.log(`[Extractor] Extracting ${normalizedArchivePath} to ${normalizedOutputDir}`);

        // Check if archive file exists
        if (!fs.existsSync(normalizedArchivePath)) {
            reject(new Error(`Archive file not found: ${normalizedArchivePath}`));
            return;
        }

        // Skip validation if it fails - some valid archives might not pass validation
        // but can still be extracted successfully
        try {
            await validateArchive(normalizedArchivePath);
            console.log('[Extractor] Archive validation passed');
        } catch (validationError) {
            console.warn('[Extractor] Archive validation failed, but proceeding with extraction:', validationError.message);
            // Continue with extraction anyway - the file might still be valid
        }

        // Ensure output directory exists
        if (!fs.existsSync(normalizedOutputDir)) {
            fs.mkdirSync(normalizedOutputDir, { recursive: true });
        }

        // Use normalized paths for extraction
        const myStream = Seven.extractFull(normalizedArchivePath, normalizedOutputDir, {
            $bin: pathTo7zip,
            $progress: true,
            recursive: true
        });

        myStream.on('progress', (progress) => {
            // progress is an object: { percent: 10, fileCount: 5, file: 'something.txt' }
            if (onProgress) {
                onProgress(progress);
            }
        });

        myStream.on('end', () => {
            console.log('[Extractor] Extraction complete');
            resolve(normalizedOutputDir);
        });

        myStream.on('error', (err) => {
            console.error('[Extractor] Error:', err);
            const errorMsg = err.message || err.toString();
            
            // Provide more helpful error messages
            if (errorMsg.includes('Cannot open the file as archive')) {
                reject(new Error('Cannot open the file as archive. The file may be corrupted, incomplete, or not a valid archive. Please check if the download completed successfully.'));
            } else if (errorMsg.includes('not supported archive')) {
                reject(new Error('Archive format is not supported or the file is corrupted.'));
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
