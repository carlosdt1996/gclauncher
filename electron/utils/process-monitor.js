import { exec } from 'child_process';
import { EventEmitter } from 'events';
import util from 'util';

const execAsync = util.promisify(exec);

class ProcessMonitor extends EventEmitter {
    constructor() {
        super();
        this.monitoredGames = new Map(); // gameId -> { name, executable, isRunning }
        this.checkInterval = null;
        this.isChecking = false;
        this.checkCount = 0;
    }

    /**
     * Register a game to be monitored
     * @param {string} gameId - Unique game ID
     * @param {string} gameName - Display name of the game
     * @param {string} executableName - Name of the executable (e.g., "game.exe")
     */
    registerGame(gameId, gameName, executableName) {
        if (!executableName) return;

        this.monitoredGames.set(gameId, {
            name: gameName,
            executable: executableName.toLowerCase(),
            isRunning: false
        });
    }

    /**
     * Start monitoring processes
     * @param {number} intervalMs - Polling interval in ms (default: 5000)
     */
    start(intervalMs = 5000) {
        if (this.checkInterval) return;

        console.log('[ProcessMonitor] Starting process monitoring...');
        this.checkProcesses(); // Initial check
        this.checkInterval = setInterval(() => this.checkProcesses(), intervalMs);
    }

    /**
     * Stop monitoring processes
     */
    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
            console.log('[ProcessMonitor] Stopped process monitoring');
        }
    }

    /**
     * Check running processes against monitored games
     */
    async checkProcesses() {
        if (this.isChecking || this.monitoredGames.size === 0) return;

        this.isChecking = true;
        try {
            // Get list of running processes
            // /nh: No Header, /fo csv: CSV format
            const { stdout } = await execAsync('tasklist /nh /fo csv');
            const processes = stdout.toLowerCase();

            // Check each monitored game
            for (const [gameId, game] of this.monitoredGames) {
                const isRunning = processes.includes(`"${game.executable}"`);

                // Debug log for specific game if it's supposed to be running but isn't found, or vice versa
                if (game.isRunning && !isRunning) {
                    console.log(`[ProcessMonitor] DEBUG: Game ${game.name} (${game.executable}) was running, now NOT found in tasklist.`);
                } else if (!game.isRunning && isRunning) {
                    console.log(`[ProcessMonitor] DEBUG: Game ${game.name} (${game.executable}) found in tasklist, marking as started.`);
                }

                if (isRunning && !game.isRunning) {
                    // Game started
                    game.isRunning = true;
                    this.emit('game-started', { gameId, gameName: game.name });
                    console.log(`[ProcessMonitor] Game started: ${game.name} (${game.executable})`);
                } else if (!isRunning && game.isRunning) {
                    // Game stopped
                    game.isRunning = false;
                    this.emit('game-stopped', { gameId, gameName: game.name });
                    console.log(`[ProcessMonitor] Game stopped: ${game.name} (${game.executable})`);
                }
            }

            // Periodic status log (every 12 checks = ~1 minute)
            if (!this.checkCount) this.checkCount = 0;
            this.checkCount++;
            if (this.checkCount % 12 === 0) {
                const runningCount = Array.from(this.monitoredGames.values()).filter(g => g.isRunning).length;
                console.log(`[ProcessMonitor] 👀 Monitoring ${this.monitoredGames.size} game(s), ${runningCount} currently running`);
            }

        } catch (error) {
            console.error('[ProcessMonitor] Error checking processes:', error);
        } finally {
            this.isChecking = false;
        }
    }
}

// Export singleton instance
const processMonitor = new ProcessMonitor();
export default processMonitor;
