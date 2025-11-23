import store from './store.js';

// Structure: { [gameId]: { totalMinutes: 0, sessions: [{start, end, minutes}], firstPlayed: timestamp } }

export function startSession(gameId, gameName) {
    const sessions = store.get('playtime_sessions', {});

    if (!sessions[gameId]) {
        sessions[gameId] = {
            name: gameName,
            totalMinutes: 0,
            sessions: [],
            firstPlayed: Date.now()
        };
    }

    // Start new session
    sessions[gameId].currentSession = {
        start: Date.now(),
        end: null
    };

    store.set('playtime_sessions', sessions);
    console.log(`Started session for ${gameName} (${gameId})`);

    return sessions[gameId];
}

export function endSession(gameId) {
    const sessions = store.get('playtime_sessions', {});

    if (!sessions[gameId] || !sessions[gameId].currentSession) {
        console.log(`No active session for ${gameId}`);
        return null;
    }

    const current = sessions[gameId].currentSession;
    current.end = Date.now();

    // Calculate minutes
    const minutes = Math.round((current.end - current.start) / 1000 / 60);
    current.minutes = minutes;

    // Add to history and total
    sessions[gameId].sessions.push(current);
    sessions[gameId].totalMinutes += minutes;
    delete sessions[gameId].currentSession;

    store.set('playtime_sessions', sessions);
    console.log(`Ended session for ${gameId}: ${minutes} minutes (Total: ${sessions[gameId].totalMinutes})`);

    return sessions[gameId];
}

export function getPlaytime(gameId) {
    const sessions = store.get('playtime_sessions', {});
    return sessions[gameId] || null;
}

export function getAllPlaytimes() {
    return store.get('playtime_sessions', {});
}

export function getActiveSession(gameId) {
    const sessions = store.get('playtime_sessions', {});
    return sessions[gameId]?.currentSession || null;
}

/**
 * Store the executable name for a game
 */
export function setGameExecutable(gameId, executableName) {
    const executables = store.get('game_executables', {});
    executables[gameId] = executableName;
    store.set('game_executables', executables);
    console.log(`[Playtime] Stored executable for ${gameId}: ${executableName}`);
}

/**
 * Get the executable name for a game
 */
export function getGameExecutable(gameId) {
    const executables = store.get('game_executables', {});
    return executables[gameId] || null;
}

/**
 * Get all game executables
 */
export function getAllGameExecutables() {
    return store.get('game_executables', {});
}

/**
 * End all active sessions (called on app shutdown)
 */
export function endAllActiveSessions() {
    const sessions = store.get('playtime_sessions', {});
    let endedCount = 0;

    for (const gameId in sessions) {
        if (sessions[gameId].currentSession) {
            endSession(gameId);
            endedCount++;
        }
    }

    if (endedCount > 0) {
        console.log(`[Playtime] Ended ${endedCount} active session(s) on shutdown`);
    }
}
