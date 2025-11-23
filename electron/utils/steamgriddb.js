import axios from 'axios';

const BASE_URL = 'https://www.steamgriddb.com/api/v2';

export const searchGame = async (gameName, apiKey) => {
    try {
        const response = await axios.get(`${BASE_URL}/search/autocomplete/${encodeURIComponent(gameName)}`, {
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });
        if (response.data && response.data.success && response.data.data.length > 0) {
            return response.data.data[0].id;
        }
        return null;
    } catch (error) {
        console.error('Error searching game:', error);
        return null;
    }
};

export const getGameGrid = async (gameId, apiKey) => {
    try {
        // Try to get official cover art - prioritize verified images with standard cover dimensions
        // Remove "alternate" style as it's often fan art, focus on official styles
        let response = await axios.get(`${BASE_URL}/grids/game/${gameId}?dimensions=600x900&mimes=image/jpeg,image/png`, {
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });
        
        if (response.data && response.data.success && response.data.data.length > 0) {
            // First priority: verified images with 600x900 (official cover art size)
            const verifiedCoverArt = response.data.data.filter(img => 
                img.verified && img.width === 600 && img.height === 900
            );
            if (verifiedCoverArt.length > 0) {
                return verifiedCoverArt[0].url;
            }
            
            // Second priority: any verified image
            const verified = response.data.data.filter(img => img.verified);
            if (verified.length > 0) {
                return verified[0].url;
            }
            
            // Third priority: 600x900 non-verified (standard cover art size)
            const coverArt = response.data.data.find(img => img.width === 600 && img.height === 900);
            if (coverArt) return coverArt.url;
        }
        
        // If no 600x900 found, try broader search but still prioritize verified
        response = await axios.get(`${BASE_URL}/grids/game/${gameId}?dimensions=600x900,920x430,460x215&mimes=image/jpeg,image/png`, {
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });
        
        if (response.data && response.data.success && response.data.data.length > 0) {
            // Strictly prioritize verified images
            const verified = response.data.data.filter(img => img.verified);
            if (verified.length > 0) {
                // Prefer 600x900 verified cover art
                const coverArt = verified.find(img => img.width === 600 && img.height === 900);
                if (coverArt) return coverArt.url;
                return verified[0].url;
            }
            
            // Only if no verified images exist, use non-verified but prefer 600x900
            const coverArt = response.data.data.find(img => img.width === 600 && img.height === 900);
            if (coverArt) return coverArt.url;
            
            // Last resort: return first available
            return response.data.data[0].url;
        }
        return null;
    } catch (error) {
        console.error('Error getting game grid:', error);
        return null;
    }
};

/**
 * Get official cover art for a game
 * Prioritizes verified/official cover art images
 */
export const getGameCoverArt = async (gameId, apiKey) => {
    // Use grids which are the cover art images (600x900 is standard cover art size)
    // The getGameGrid function already prioritizes verified images
    return await getGameGrid(gameId, apiKey);
};

export const fetchGameImage = async (gameName, apiKey) => {
    const gameId = await searchGame(gameName, apiKey);
    if (gameId) {
        // Use cover art (hero) for official cover images
        return await getGameCoverArt(gameId, apiKey);
    }
    return null;
};

export const searchGameDetailed = async (gameName, apiKey) => {
    try {
        const response = await axios.get(`${BASE_URL}/search/autocomplete/${encodeURIComponent(gameName)}`, {
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });
        if (response.data && response.data.success && response.data.data.length > 0) {
            // Return all matching games with full details
            let games = response.data.data.map(game => ({
                id: game.id,
                name: game.name,
                releaseDate: game.release_date || null,
                verified: game.verified || false
            }));

            // Sort: verified games first
            games.sort((a, b) => {
                if (a.verified && !b.verified) return -1;
                if (!a.verified && b.verified) return 1;
                return 0;
            });

            // Get official cover art for all results
            await Promise.all(games.map(async (game) => {
                const imageUrl = await getGameCoverArt(game.id, apiKey);
                game.imageUrl = imageUrl;
            }));

            return games;
        }
        return [];
    } catch (error) {
        console.error('Error searching game detailed:', error);
        return [];
    }
};
