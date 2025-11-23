import axios from 'axios';
import crypto from 'crypto';
import fs from 'fs';

const VIRUSTOTAL_API_BASE = 'https://www.virustotal.com/api/v3';

/**
 * Get file report from VirusTotal using file hash (MD5, SHA-1, or SHA-256)
 * @param {string} fileHash - The hash of the file
 * @param {string} apiKey - VirusTotal API key
 * @returns {Promise<Object>} VirusTotal report
 */
export async function getFileReport(fileHash, apiKey) {
    try {
        const response = await axios.get(
            `${VIRUSTOTAL_API_BASE}/files/${fileHash}`,
            {
                headers: {
                    'x-apikey': apiKey
                }
            }
        );
        return response.data;
    } catch (error) {
        if (error.response && error.response.status === 404) {
            return { notFound: true };
        }
        console.error('[VirusTotal] Error getting report:', error.message);
        throw error;
    }
}

/**
 * Calculate SHA-256 hash of a file
 * @param {string} filePath - Path to the file
 * @returns {Promise<string>} SHA-256 hash
 */
export async function calculateFileHash(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);

        stream.on('data', (data) => hash.update(data));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', (err) => reject(err));
    });
}


