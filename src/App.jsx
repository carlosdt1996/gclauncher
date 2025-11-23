import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import './App.css'
import { useGamepad } from './hooks/useGamepad'

function App() {
  const [games, setGames] = useState([])
  const [apiKey, setApiKey] = useState('')
  const [tempApiKey, setTempApiKey] = useState('')
  const [images, setImages] = useState({})
  const [showSettings, setShowSettings] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('steam')
  const [selectedGame, setSelectedGame] = useState(null)
  const [showGameDetails, setShowGameDetails] = useState(false)
  const [backloggdUser, setBackloggdUser] = useState(null)
  const [gameRating, setGameRating] = useState(null)
  const [playtimeData, setPlaytimeData] = useState({})
  const [activeSession, setActiveSession] = useState(null)
  const [fitgirlGames, setFitgirlGames] = useState([])
  const [fitgirlLoading, setFitgirlLoading] = useState(false)
  const [fitgirlSearchQuery, setFitgirlSearchQuery] = useState('')
  const [fitgirlSearchResults, setFitgirlSearchResults] = useState([])
  const [downloads, setDownloads] = useState([])
  const [showDownloadManager, setShowDownloadManager] = useState(false)
  const [selectedFitgirlGame, setSelectedFitgirlGame] = useState(null)
  const [showFitgirlDetails, setShowFitgirlDetails] = useState(false)
  const [fitgirlGameDetails, setFitgirlGameDetails] = useState(null)
  const [rdApiKey, setRdApiKey] = useState('')
  const [tempRdApiKey, setTempRdApiKey] = useState('')
  const [downloadFolder, setDownloadFolder] = useState('')
  const [tempDownloadFolder, setTempDownloadFolder] = useState('')
  const [installFolder, setInstallFolder] = useState('');
  const [tempInstallFolder, setTempInstallFolder] = useState('');
  const [rdDownloads, setRdDownloads] = useState([]);
  const [virustotalApiKey, setVirustotalApiKey] = useState('');
  const [tempVirustotalApiKey, setTempVirustotalApiKey] = useState('');
  const [theme, setTheme] = useState('pc'); // 'pc' or 'tv'
  const themeRef = useRef('pc');
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  // Memoized games list based on theme
  const displayedGames = useMemo(() => {
    if (theme === 'tv') {
      return [...games].sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));
    }
    return games;
  }, [games, theme]);

  const displayedGamesRef = useRef([]);

  useEffect(() => {
    displayedGamesRef.current = displayedGames;
  }, [displayedGames]);

  // Torrent Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false); // Dropdown state
  const [torrentResults, setTorrentResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedSearchGame, setSelectedSearchGame] = useState(null);
  const [gameDetails, setGameDetails] = useState(null);
  const [gameDetailsLoading, setGameDetailsLoading] = useState(false);
  const [repackFilter, setRepackFilter] = useState(['fitgirl', 'elamigos', 'rune', 'empress', 'tenoke', 'dodi']);
  const [sortBy, setSortBy] = useState('seeders');

  // Gamepad/Controller support
  const { isConnected, getAxis, isButtonPressed, onButtonPress } = useGamepad();
  const [controllerSelectedIndex, setControllerSelectedIndex] = useState(-1);
  const controllerSelectedIndexRef = useRef(-1);
  const [controllerTabIndex, setControllerTabIndex] = useState(0);
  const [modalButtonIndex, setModalButtonIndex] = useState(0); // 0 = Play, 1 = Close
  const modalButtonIndexRef = useRef(0);
  const lastAxisStateRef = useRef({ x: 0, y: 0 });
  const lastDPadStateRef = useRef({ up: false, down: false, dPadY: 0 });
  const axisThreshold = 0.5; // Dead zone for sticks/D-pad
  const axisCooldown = 150; // ms between axis movements
  const lastAxisMoveRef = useRef(0);
  const lastDPadMoveRef = useRef(0);
  const gamepadPollIntervalRef = useRef(null);

  // Cover Art Selector states
  const [showCoverArtSelector, setShowCoverArtSelector] = useState(false);
  const [availableCovers, setAvailableCovers] = useState([]);
  const [selectedCoverIndex, setSelectedCoverIndex] = useState(0);
  const [coversLoading, setCoversLoading] = useState(false);
  const selectedCoverIndexRef = useRef(0);

  // Keep refs in sync
  useEffect(() => {
    controllerSelectedIndexRef.current = controllerSelectedIndex;
  }, [controllerSelectedIndex]);

  useEffect(() => {
    selectedCoverIndexRef.current = selectedCoverIndex;

    // Auto-scroll to keep selected cover visible
    if (showCoverArtSelector && availableCovers.length > 0) {
      const selectedElement = document.querySelector('.cover-art-item.controller-selected');
      if (selectedElement) {
        selectedElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    }
  }, [selectedCoverIndex, showCoverArtSelector, availableCovers.length]);

  // Auto-scroll for TV theme games
  useEffect(() => {
    if (theme === 'tv' && activeTab === 'steam') {
      // Find the selected wrapper
      const wrappers = document.querySelectorAll('.game-wrapper');
      if (wrappers[controllerSelectedIndex]) {
        wrappers[controllerSelectedIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [controllerSelectedIndex, theme, activeTab]);

  // Fetch game details when a game is selected
  useEffect(() => {
    const fetchDetails = async () => {
      if (selectedSearchGame) {
        setGameDetailsLoading(true);
        setGameDetails(null);
        try {
          const details = await window.electronAPI.backloggdGetDetails(selectedSearchGame.name);
          setGameDetails(details);
        } catch (error) {
          console.error('Error fetching game details:', error);
        } finally {
          setGameDetailsLoading(false);
        }
      }
    };
    fetchDetails();
  }, [selectedSearchGame]);

  const handledDownloads = useRef(new Set());


  useEffect(() => {
    const init = async () => {
      console.log('FRONTEND: Initializing...');
      if (window.electronAPI) {
        console.log('FRONTEND: electronAPI available');
        try {
          const key = await window.electronAPI.getApiKey();
          console.log('FRONTEND: API key:', key ? 'SET' : 'NOT SET');
          setApiKey(key || '');
          setTempApiKey(key || '');

          // Load Real-Debrid API key
          const rdKey = await window.electronAPI.getRdApiKey();
          setRdApiKey(rdKey || '');
          setTempRdApiKey(rdKey || '');

          // Load download folder
          const folder = await window.electronAPI.getDownloadFolder();
          setDownloadFolder(folder || '');
          setTempDownloadFolder(folder || '');

          // Load install folder
          const iFolder = await window.electronAPI.getInstallFolder();
          setInstallFolder(iFolder || '');
          setTempInstallFolder(iFolder || '');

          // Load VirusTotal API key
          const vtKey = await window.electronAPI.getVirustotalApiKey();
          setVirustotalApiKey(vtKey || '');
          setTempVirustotalApiKey(vtKey || '');

          const user = await window.electronAPI.getBackloggdUser();
          if (user) setBackloggdUser(user);

          // Load all playtime data
          const allPlaytimes = await window.electronAPI.getAllPlaytimes();
          setPlaytimeData(allPlaytimes);

          console.log('FRONTEND: Fetching games...');
          const fetchedGames = await window.electronAPI.getGames();
          console.log('FRONTEND: Received games:', fetchedGames);
          console.log('FRONTEND: Number of games:', fetchedGames ? fetchedGames.length : 0);

          if (fetchedGames && Array.isArray(fetchedGames)) {
            setGames(fetchedGames);
          } else {
            console.error('FRONTEND: fetchedGames is not an array:', typeof fetchedGames);
            setGames([]);
          }
          setLoading(false);

          // Set up Real-Debrid download progress listener
          if (window.electronAPI.onRdDownloadProgress) {
            window.electronAPI.onRdDownloadProgress((progress) => {
              console.log('[RD Progress]', progress);
              setRdDownloads(prev => {
                const existing = prev.find(d => d.filename === progress.filename);
                if (existing) {
                  return prev.map(d => d.filename === progress.filename ? { ...d, ...progress } : d);
                } else {
                  return [...prev, progress];
                }
              });
            });
          }

          if (key && fetchedGames) {
            fetchedGames.forEach(async (game) => {
              // Check for saved cover art by game.id, with fallback to game.name
              const img = await window.electronAPI.getGameImage(game.id, game.name);
              if (img) {
                setImages(prev => ({ ...prev, [game.id]: img }));
              }
            });
          }
        } catch (error) {
          console.error('FRONTEND: Error during initialization:', error);
          setLoading(false);
        }
      } else {
        console.error('FRONTEND: electronAPI not available!');
        setLoading(false);
      }
    };
    init();
  }, []);

  const handleManualRefresh = async () => {
    console.log('MANUAL: Refreshing games...');
    setLoading(true);
    try {
      const fetchedGames = await window.electronAPI.getGames();
      console.log('MANUAL: Received games:', fetchedGames);
      setGames(fetchedGames || []);
      setLoading(false);
    } catch (error) {
      console.error('MANUAL: Error:', error);
      setLoading(false);
    }
  };

  // Fetch API key and theme on mount
  useEffect(() => {
    const fetchApiKey = async () => {
      if (window.electronAPI) {
        const key = await window.electronAPI.getApiKey();
        if (key) {
          setApiKey(key);
          setTempApiKey(key);
        }

        // Load theme preference
        const savedTheme = localStorage.getItem('theme') || 'pc';
        setTheme(savedTheme);
        document.body.className = savedTheme === 'tv' ? 'tv-theme' : '';
      }
    };
    fetchApiKey();
  }, []);

  const handleSaveKey = async () => {
    if (window.electronAPI) {
      await window.electronAPI.setApiKey(tempApiKey);
      setApiKey(tempApiKey);

      // Save Real-Debrid API key
      if (tempRdApiKey !== undefined) {
        await window.electronAPI.setRdApiKey(tempRdApiKey);
        setRdApiKey(tempRdApiKey);
      }

      // Save download folder
      if (tempDownloadFolder !== undefined) {
        await window.electronAPI.setDownloadFolder(tempDownloadFolder);
        setDownloadFolder(tempDownloadFolder);
      }

      // Save install folder
      if (tempInstallFolder !== undefined) {
        await window.electronAPI.setInstallFolder(tempInstallFolder);
        setInstallFolder(tempInstallFolder);
      }

      // Save VirusTotal API key
      if (tempVirustotalApiKey !== undefined) {
        await window.electronAPI.setVirustotalApiKey(tempVirustotalApiKey);
        setVirustotalApiKey(tempVirustotalApiKey);
      }

      setShowSettings(false);
      window.location.reload();

      // Fetch images for games
      if (tempApiKey) {
        games.forEach(async (game) => {
          // Check for saved cover art by game.id, with fallback to game.name
          const img = await window.electronAPI.getGameImage(game.id, game.name);
          if (img) {
            setImages(prev => ({ ...prev, [game.id]: img }));
          }
        });
      }
    }
    setShowSettings(false);
  };

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.body.className = newTheme === 'tv' ? 'tv-theme' : '';
  };

  const handleBackloggdLogin = async () => {
    try {
      const result = await window.electronAPI.backloggdLogin();
      if (result.success) {
        setBackloggdUser(result.username);
      } else {
        alert('Login failed or cancelled');
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('Login error');
    }
  };

  const handleGameClick = useCallback(async (game) => {
    setSelectedGame(game);
    setShowGameDetails(true);
    setGameRating(null); // Reset
    setModalButtonIndex(2); // Reset to Play button (index 2)

    if (window.electronAPI) {
      const result = await window.electronAPI.getBackloggdRating(game.name);
      if (result && result.rating) {
        setGameRating(result.rating);
      }
    }
  }, []);

  const handleCloseGameDetails = () => {
    setShowGameDetails(false);
    setSelectedGame(null);
    setModalButtonIndex(2); // Reset to Play button for next time
  };

  const handlePlayGame = async () => {
    if (selectedGame && window.electronAPI) {
      try {
        await window.electronAPI.launchGame(selectedGame);
      } catch (error) {
        console.error('Error launching game:', error);
        alert('Failed to launch game: ' + error.message);
      }
    }
  };

  const handleUninstallGame = async () => {
    if (!selectedGame) return;

    const confirmMessage = `Are you sure you want to uninstall "${selectedGame.name}"?\n\nThis will remove the game from your library. The game files will remain on your disk.`;

    if (confirm(confirmMessage)) {
      try {
        if (window.electronAPI && window.electronAPI.removeCustomGame) {
          await window.electronAPI.removeCustomGame(selectedGame.id);

          // Refresh the games list
          const updatedGames = await window.electronAPI.getGames();
          setGames(updatedGames);

          // Close the modal
          handleCloseGameDetails();

          alert(`"${selectedGame.name}" has been removed from your library.`);
        } else {
          alert('Uninstall feature is not available.');
        }
      } catch (error) {
        console.error('Error uninstalling game:', error);
        alert('Failed to uninstall game: ' + error.message);
      }
    }
  };

  const handleOpenCoverArtSelector = useCallback(async () => {
    if (!selectedGame || !apiKey) {
      alert('SteamGridDB API key is required to change cover art.');
      return;
    }

    setShowCoverArtSelector(true);
    setCoversLoading(true);
    setSelectedCoverIndex(0);
    selectedCoverIndexRef.current = 0;

    try {
      // Use backend API to fetch covers (avoids CORS issues)
      const result = await window.electronAPI.getGameCovers(selectedGame.name);

      if (result.success && result.data && result.data.length > 0) {
        setAvailableCovers(result.data);
      } else {
        setAvailableCovers([]);
        alert(result.error || 'No alternative covers found for this game.');
      }
    } catch (error) {
      console.error('Error fetching covers:', error);
      setAvailableCovers([]);
      alert('Error fetching covers: ' + error.message);
    }

    setCoversLoading(false);
  }, [selectedGame, apiKey]);

  const handleApplyCoverArt = useCallback(async () => {
    if (availableCovers.length > 0 && selectedCoverIndex >= 0 && selectedGame) {
      const newCoverUrl = availableCovers[selectedCoverIndex];
      setImages(prev => ({ ...prev, [selectedGame.id]: newCoverUrl }));

      // Save the cover art to persistent storage
      if (window.electronAPI && window.electronAPI.setGameImage) {
        try {
          await window.electronAPI.setGameImage(selectedGame.id, newCoverUrl);
          console.log('Cover art saved for game:', selectedGame.id);
        } catch (error) {
          console.error('Error saving cover art:', error);
        }
      }

      setShowCoverArtSelector(false);
      // Removed alert to avoid losing focus
    }
  }, [availableCovers, selectedCoverIndex, selectedGame]);

  const handleCloseCoverArtSelector = useCallback(() => {
    setShowCoverArtSelector(false);
    setAvailableCovers([]);
    setSelectedCoverIndex(0);
    selectedCoverIndexRef.current = 0;
  }, []);

  const handleEndSession = async (gameId) => {
    if (window.electronAPI) {
      try {
        const result = await window.electronAPI.endSession(gameId);
        if (result) {
          // Refresh playtime data
          const allPlaytimes = await window.electronAPI.getAllPlaytimes();
          setPlaytimeData(allPlaytimes);
          setActiveSession(null);
        }
      } catch (error) {
        console.error('Error ending session:', error);
      }
    }
  };

  // FitGirl handlers
  const loadFitgirlGames = async () => {
    if (!window.electronAPI) return;
    setFitgirlLoading(true);
    try {
      const games = await window.electronAPI.fitgirlGetGames();
      setFitgirlGames(games);
    } catch (error) {
      console.error('Error loading FitGirl games:', error);
    }
    setFitgirlLoading(false);
  };

  const searchFitgirlGames = async (query) => {
    if (!window.electronAPI || !query.trim()) {
      setFitgirlSearchResults([]);
      return;
    }
    setFitgirlLoading(true);
    try {
      const results = await window.electronAPI.fitgirlSearch(query);
      setFitgirlSearchResults(results);
    } catch (error) {
      console.error('Error searching FitGirl games:', error);
    }
    setFitgirlLoading(false);
  };

  // Debounced search effect - only search after user stops typing for 500ms
  useEffect(() => {
    if (!fitgirlSearchQuery.trim()) {
      setFitgirlSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      searchFitgirlGames(fitgirlSearchQuery);
    }, 500); // Wait 500ms after user stops typing

    return () => clearTimeout(timeoutId); // Cleanup on unmount or query change
  }, [fitgirlSearchQuery]);

  const handleDownloadGame = async (game) => {
    if (!window.electronAPI) return;
    try {
      // Get game details to fetch magnet link
      const details = await window.electronAPI.fitgirlGetDetails(game.pageUrl);
      if (details.magnetLink) {
        await window.electronAPI.startDownload(details.magnetLink, game.title);
        setShowDownloadManager(true);
        // Refresh downloads list
        const allDownloads = await window.electronAPI.getAllDownloads();
        setDownloads(allDownloads);
      } else {
        alert('Magnet link not found for this game');
      }
    } catch (error) {
      console.error('Error starting download:', error);
      alert('Failed to start download: ' + error.message);
    }
  };

  const handleFitgirlGameClick = async (game) => {
    if (!window.electronAPI) return;
    try {
      setSelectedFitgirlGame(game);
      setShowFitgirlDetails(true);
      setFitgirlGameDetails(null); // Reset details while loading

      // Fetch full game details (magnet link, description, etc.)
      const details = await window.electronAPI.fitgirlGetDetails(game.pageUrl);
      setFitgirlGameDetails(details);
    } catch (error) {
      console.error('Error fetching game details:', error);
      alert('Failed to load game details: ' + error.message);
    }
  };

  const cancelledDownloads = useRef(new Set());

  const startRealDebridDownload = async (magnetLink, gameName, image = null) => {
    if (!rdApiKey) {
      // Fallback to WebTorrent
      console.log('[Frontend] No Real-Debrid API key, using WebTorrent...');
      try {
        const result = await window.electronAPI.startDownload(magnetLink, gameName);
        console.log('[Frontend] WebTorrent download started:', result);
        setShowDownloadManager(true);
        // Refresh downloads list
        const allDownloads = await window.electronAPI.getAllDownloads();
        setDownloads(allDownloads);
      } catch (error) {
        console.error('[Frontend] WebTorrent download error:', error);
        alert('Failed to start download: ' + error.message);
      }
      return;
    }

    // Use Real-Debrid
    try {
      console.log('[Frontend] Starting Real-Debrid download...');
      setShowDownloadManager(true);

      // Add initial "preparing" state
      const downloadId = Date.now().toString(); // Temporary ID for UI
      setRdDownloads(prev => [...prev, {
        id: downloadId,
        filename: gameName,
        status: 'preparing',
        progressStep: 'Adding magnet...',
        percentage: 0,
        loaded: 0,
        total: 0
      }]);

      // Helper to update status
      const updateStatus = (step, percent = 0) => {
        if (cancelledDownloads.current.has(downloadId)) throw new Error('Download cancelled by user');
        setRdDownloads(prev => prev.map(d =>
          d.id === downloadId ? { ...d, progressStep: step, percentage: percent } : d
        ));
      };

      // Step 1: Add magnet to Real-Debrid
      updateStatus('Adding magnet...', 10);
      const addResult = await window.electronAPI.rdAddMagnet(magnetLink, rdApiKey);
      if (!addResult.success) {
        throw new Error(addResult.error || 'Failed to add magnet to Real-Debrid');
      }

      const torrentId = addResult.data.id;
      console.log('[Frontend] Magnet added, torrent ID:', torrentId);
      updateStatus('Waiting for torrent info...', 20);

      // Step 2: Wait for torrent to be ready and get file list
      let torrentInfo;
      let attempts = 0;
      while (attempts < 30) {
        if (cancelledDownloads.current.has(downloadId)) throw new Error('Download cancelled by user');

        const infoResult = await window.electronAPI.rdGetTorrentInfo(torrentId, rdApiKey);
        if (!infoResult.success) {
          throw new Error('Failed to get torrent info');
        }

        torrentInfo = infoResult.data;

        // Pre-download Virus check (using Torrent InfoHash)
        if (torrentInfo && torrentInfo.hash && virustotalApiKey && attempts === 0) {
          console.log('[Frontend] Checking Torrent InfoHash:', torrentInfo.hash);
          const scanResult = await window.electronAPI.scanHashVirustotal(torrentInfo.hash);

          if (scanResult.success && scanResult.status === 'malicious') {
            const stats = scanResult.stats;
            const maliciousCount = stats ? stats.malicious : 'unknown';
            if (!confirm(`⚠️ WARNING: VirusTotal flagged this torrent as malicious!\n\nDetections: ${maliciousCount}\nLink: ${scanResult.permalink}\n\nDo you want to continue downloading?`)) {
              throw new Error('Download cancelled: Malicious torrent detected');
            }
          }
        }

        if (torrentInfo.status === 'downloaded' || torrentInfo.status === 'waiting_files_selection') {
          break;
        }

        updateStatus(`Waiting for info (${attempts + 1}/30)...`, 20 + (attempts));
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;
      }

      // Step 3: Select all files
      updateStatus('Selecting files...', 50);
      const selectResult = await window.electronAPI.rdSelectFiles(torrentId, 'all', rdApiKey);
      if (!selectResult.success) {
        throw new Error('Failed to select files');
      }

      // Step 4: Wait for download link to be ready
      updateStatus('Waiting for download links...', 60);
      attempts = 0;
      while (attempts < 30) {
        if (cancelledDownloads.current.has(downloadId)) throw new Error('Download cancelled by user');

        const infoResult = await window.electronAPI.rdGetTorrentInfo(torrentId, rdApiKey);
        torrentInfo = infoResult.data;

        if (torrentInfo.links && torrentInfo.links.length > 0) {
          break;
        }

        updateStatus(`Waiting for links (${attempts + 1}/30)...`, 60 + (attempts));
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;
      }

      if (!torrentInfo.links || torrentInfo.links.length === 0) {
        throw new Error('No download links available after waiting');
      }

      // Step 5: Get unrestricted link
      updateStatus('Getting download link...', 90);
      const unrestrictResult = await window.electronAPI.rdGetUnrestrictedLink(torrentInfo.links[0], rdApiKey);
      if (!unrestrictResult.success) {
        throw new Error('Failed to get download link');
      }

      // Step 6: Start download
      updateStatus('Starting download...', 100);

      // Remove the temporary "preparing" item and let the real download take over
      // or update it to match the real download structure
      setRdDownloads(prev => prev.filter(d => d.id !== downloadId));

      // Add actual download entry
      const downloadEntry = {
        filename: unrestrictResult.data.filename,
        loaded: 0,
        total: unrestrictResult.data.filesize || 0,
        percentage: 0,
        status: 'downloading',
        gameName: gameName, // Store game name for later
        image: image // Store image for later
      };
      setRdDownloads(prev => [...prev, downloadEntry]);

      const downloadResult = await window.electronAPI.rdDownloadFile(
        unrestrictResult.data.download,
        unrestrictResult.data.filename,
        downloadFolder
      );

      if (downloadResult.success) {
        console.log('[Frontend] Download started successfully!');

        let finalPath = downloadResult.path;

        // Check if needs extraction
        const isArchive = ['.zip', '.rar', '.7z'].some(ext => finalPath.toLowerCase().endsWith(ext));

        if (isArchive) {
          console.log('[Frontend] Archive detected, starting extraction...');
          setRdDownloads(prev => prev.map(d =>
            d.filename === unrestrictResult.data.filename
              ? { ...d, status: 'extracting', percentage: 0, loaded: 0, total: 100 }
              : d
          ));

          const extractResult = await window.electronAPI.extractArchive(finalPath);

          if (extractResult.success) {
            finalPath = extractResult.outputDir;
            setRdDownloads(prev => prev.map(d =>
              d.filename === unrestrictResult.data.filename
                ? { ...d, status: 'completed', percentage: 100 }
                : d
            ));
          } else {
            console.error('[Frontend] Extraction failed:', extractResult.error);
            alert('Extraction failed: ' + extractResult.error);
            return; // Stop here if extraction fails
          }
        } else {
          setRdDownloads(prev => prev.map(d =>
            d.filename === unrestrictResult.data.filename
              ? { ...d, status: 'completed' }
              : d
          ));
        }

        // Post-download automation
        let shouldInstall = false;

        // Virus scan integration
        if (window.electronAPI.getVirustotalApiKey) { // Check if feature exists
          // Only prompt if key is set or to educate user
          const hasVtKey = await window.electronAPI.getVirustotalApiKey();

          if (hasVtKey) {
            if (confirm(`Download complete: ${gameName}\n\nDo you want to scan this file with VirusTotal before installing?`)) {
              console.log('[Frontend] Starting VirusTotal scan...');
              // Update UI to show scanning
              setRdDownloads(prev => prev.map(d =>
                d.filename === unrestrictResult.data.filename
                  ? { ...d, status: 'scanning', percentage: 100 } // scanning state
                  : d
              ));

              const scanResult = await window.electronAPI.scanFileVirustotal(finalPath);
              console.log('[Frontend] Scan result:', scanResult);

              if (scanResult.success) {
                if (scanResult.status === 'clean') {
                  if (confirm(`✅ VirusTotal Scan Clean!\n\nHash: ${scanResult.hash}\n\nProceed with installation?`)) {
                    shouldInstall = true;
                  }
                } else if (scanResult.status === 'malicious') {
                  const stats = scanResult.stats;
                  const maliciousCount = stats ? stats.malicious : 'unknown';
                  if (confirm(`⚠️ WARNING: VirusTotal detected potential threats!\n\nDetections: ${maliciousCount}\nLink: ${scanResult.permalink}\n\nDo you still want to install?`)) {
                    shouldInstall = true;
                  }
                } else {
                  if (confirm(`VirusTotal Report Not Found (New File).\n\nHash: ${scanResult.hash}\n\nProceed with installation?`)) {
                    shouldInstall = true;
                  }
                }
              } else {
                alert(`VirusTotal scan failed: ${scanResult.error}\n\nProceeding with installation prompt.`);
                shouldInstall = confirm(`Download complete: ${gameName}\n\nDo you want to install this game now?`);
              }

              // Reset status to completed after scan
              setRdDownloads(prev => prev.map(d =>
                d.filename === unrestrictResult.data.filename
                  ? { ...d, status: 'completed', percentage: 100 }
                  : d
              ));

            } else {
              shouldInstall = confirm(`Do you want to install this game now?`);
            }
          } else {
            shouldInstall = confirm(`Download complete: ${gameName}\n\nDo you want to install this game now?`);
          }
        } else {
          shouldInstall = confirm(`Download complete: ${gameName}\n\nDo you want to install this game now?`);
        }

        if (shouldInstall) {
          // 1. Launch Installer
          const installResult = await window.electronAPI.runInstaller(finalPath);

          if (!installResult.success) {
            alert('Could not find setup.exe automatically. Please check the download folder.');
          }

          // 2. Add to Library
          await window.electronAPI.addCustomGame({
            name: gameName,
            installPath: installFolder || '',
            executable: '',
            image: image
          });

          // Refresh library
          const updatedGames = await window.electronAPI.getGames();
          setGames(updatedGames);

          // Fetch SteamGridDB image if needed
          if (!image) {
            const img = await window.electronAPI.getGameImage(gameName);
            if (img) {
              setImages(prev => ({ ...prev, [updatedGames.find(g => g.name === gameName)?.id]: img }));
            }
          }

          alert(`${gameName} has been added to your library!`);
        }

      } else {
        throw new Error(downloadResult.error);
      }
    } catch (error) {
      console.error('[Frontend] Error downloading game:', error);
      // Remove the preparing item if it exists
      setRdDownloads(prev => prev.filter(d => d.id !== downloadId)); // Use ID to be safe

      if (error.message !== 'Download cancelled by user') {
        alert('Failed to start download: ' + error.message);
      }
    }
  };

  const handleDownloadFitgirlGame = async () => {
    if (!fitgirlGameDetails || !fitgirlGameDetails.magnetLink) {
      alert('Magnet link not found for this game');
      return;
    }
    setShowFitgirlDetails(false);
    await startRealDebridDownload(fitgirlGameDetails.magnetLink, selectedFitgirlGame.title, selectedFitgirlGame.image);
  };

  // Torrent Search handlers
  const handleSearchGame = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      setTorrentResults([]);
      setSelectedSearchGame(null);
      setIsCracked(null);
      return;
    }

    setSearchLoading(true);
    setTorrentResults([]); // Clear previous torrent results
    try {
      // Search SteamGridDB for game info
      const result = await window.electronAPI.searchGameSteamGrid(query);

      if (result.success) {
        if (result.data.length > 0) {
          setSearchResults(result.data);
          // Only show dropdown, don't auto-select
          // setSelectedSearchGame(result.data[0]); 
          setShowDropdown(true);
        } else {
          setSearchResults([]);
          setSelectedSearchGame(null);
        }
      } else {
        // Handle error (e.g. missing API key)
        setSearchResults([]);
        setSelectedSearchGame(null);
        console.error('[Search] Failed:', result.error);
        if (result.error === 'SteamGridDB API key not set') {
          alert('Please set your SteamGridDB API Key in Settings to use the search.');
          setShowSettings(true);
        } else {
          alert(`Search failed: ${result.error}`);
        }
      }
    } catch (error) {
      console.error('[Search] Error:', error);
      setSearchResults([]);
      alert('An error occurred while searching.');
    }
    setSearchLoading(false);
  };

  const searchTorrentsForGame = useCallback(async (gameName) => {
    setSearchLoading(true);
    // Note: Crack status is now checked separately when game is selected
    try {
      const result = await window.electronAPI.searchTorrents(gameName, {
        repackers: repackFilter,
        maxResults: 20,
        minSeeders: 1
      });
      if (result.success) {
        let results = result.data;
        // Sort results
        if (sortBy === 'seeders') {
          results = results.sort((a, b) => b.seeders - a.seeders);
        } else if (sortBy === 'size') {
          results = results.sort((a, b) => {
            const sizeA = parseSize(a.size);
            const sizeB = parseSize(b.size);
            return sizeB - sizeA;
          });
        }
        setTorrentResults(results);
      }
    } catch (error) {
      console.error('[Torrent Search] Error:', error);
    }
    setSearchLoading(false);
  }, [repackFilter, sortBy]);

  const parseSize = (sizeStr) => {
    const match = sizeStr.match(/([0-9.]+)\s*([KMGT]i?B)/i);
    if (!match) return 0;
    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    const multipliers = { 'KB': 1024, 'MB': 1024 ** 2, 'GB': 1024 ** 3, 'TB': 1024 ** 4, 'KIB': 1024, 'MIB': 1024 ** 2, 'GIB': 1024 ** 3, 'TIB': 1024 ** 4 };
    return value * (multipliers[unit] || 1);
  };

  const handleDownloadTorrent = async (torrent) => {
    if (torrent.ddlUrl && !torrent.magnetLink) {
      // Handle Direct Download Link (ElAmigos)
      if (window.electronAPI && window.electronAPI.openExternal) {
        await window.electronAPI.openExternal(torrent.ddlUrl);
      } else {
        window.open(torrent.ddlUrl, '_blank');
      }
      return;
    }

    if (!torrent.magnetLink) {
      alert('No magnet link available for this torrent');
      return;
    }

    // Use the unified download handler
    // We can try to use the selected game's image if available
    const image = selectedSearchGame ? selectedSearchGame.imageUrl : null;
    await startRealDebridDownload(torrent.magnetLink, selectedSearchGame ? selectedSearchGame.name : torrent.name, image);
  };

  // Live search effect
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setTorrentResults([]);
      return;
    }

    handleSearchGame(searchQuery);
  }, [searchQuery]);

  // Re-search torrents when filter or sort changes
  useEffect(() => {
    // Only re-search if we already have results, implying the user initiated a search
    if (selectedSearchGame && torrentResults.length > 0) {
      searchTorrentsForGame(selectedSearchGame.name);
    }
  }, [repackFilter, sortBy, selectedSearchGame, searchTorrentsForGame]);

  // Track previous tab to detect tab changes
  const prevTabRef = useRef(activeTab);

  // Initialize controller selection ONLY when tab changes or controller first connects
  useEffect(() => {
    if (!isConnected) {
      return;
    }

    const tabChanged = prevTabRef.current !== activeTab;
    prevTabRef.current = activeTab;

    // Only reset when tab actually changes
    if (tabChanged) {
      console.log('[Init] Tab changed from', prevTabRef.current, 'to', activeTab);
      if (activeTab === 'steam' && games.length > 0) {
        controllerSelectedIndexRef.current = 0;
        setControllerSelectedIndex(0);
      } else if (activeTab === 'search' && searchResults.length > 0) {
        controllerSelectedIndexRef.current = 0;
        setControllerSelectedIndex(0);
      }
    } else if (controllerSelectedIndexRef.current < 0) {
      // Only initialize if index is invalid (first time)
      if (activeTab === 'steam' && games.length > 0) {
        controllerSelectedIndexRef.current = 0;
        setControllerSelectedIndex(0);
      } else if (activeTab === 'search' && searchResults.length > 0) {
        controllerSelectedIndexRef.current = 0;
        setControllerSelectedIndex(0);
      }
    }
  }, [isConnected, activeTab, games.length, searchResults.length]);


  // Store current values in refs to avoid stale closures
  const activeTabRef = useRef(activeTab);
  const gamesRef = useRef(games);
  const searchResultsRef = useRef(searchResults);
  const torrentResultsRef = useRef(torrentResults);
  const showGameDetailsRef = useRef(showGameDetails);
  const showCoverArtSelectorRef = useRef(showCoverArtSelector);
  const availableCoversRef = useRef(availableCovers);
  const showSettingsRef = useRef(showSettings);

  // Keep refs in sync
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);
  useEffect(() => {
    gamesRef.current = games;
  }, [games]);
  useEffect(() => {
    searchResultsRef.current = searchResults;
  }, [searchResults]);
  useEffect(() => {
    torrentResultsRef.current = torrentResults;
  }, [torrentResults]);
  useEffect(() => {
    showGameDetailsRef.current = showGameDetails;
  }, [showGameDetails]);
  useEffect(() => {
    showCoverArtSelectorRef.current = showCoverArtSelector;
  }, [showCoverArtSelector]);
  useEffect(() => {
    showSettingsRef.current = showSettings;
  }, [showSettings]);
  useEffect(() => {
    availableCoversRef.current = availableCovers;
  }, [availableCovers]);
  useEffect(() => {
    modalButtonIndexRef.current = modalButtonIndex;
  }, [modalButtonIndex]);

  // Gamepad navigation logic - simplified and more direct
  useEffect(() => {
    if (!isConnected) {
      setControllerSelectedIndex(-1);
      if (gamepadPollIntervalRef.current) {
        clearInterval(gamepadPollIntervalRef.current);
        gamepadPollIntervalRef.current = null;
      }
      return;
    }

    console.log('[Gamepad] Starting gamepad navigation, isConnected:', isConnected);

    // Spatial navigation helper
    const navigateGrid = (currentIndex, direction, selector) => {
      const items = document.querySelectorAll(selector);
      if (!items.length || currentIndex < 0 || currentIndex >= items.length) return currentIndex;

      const currentItem = items[currentIndex];
      const currentRect = currentItem.getBoundingClientRect();
      const currentCenter = {
        x: currentRect.left + currentRect.width / 2,
        y: currentRect.top + currentRect.height / 2
      };

      let bestCandidate = -1;
      let minDistance = Infinity;

      items.forEach((item, index) => {
        if (index === currentIndex) return;

        const rect = item.getBoundingClientRect();
        const center = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2
        };

        // Direction checks
        let isValid = false;
        const overlapThreshold = 20; // Allow more overlap for diagonal tolerance

        switch (direction) {
          case 'up':
            isValid = center.y < currentCenter.y - overlapThreshold;
            break;
          case 'down':
            isValid = center.y > currentCenter.y + overlapThreshold;
            break;
          case 'left':
            isValid = center.x < currentCenter.x - overlapThreshold;
            break;
          case 'right':
            isValid = center.x > currentCenter.x + overlapThreshold;
            break;
        }

        if (isValid) {
          const dx = center.x - currentCenter.x;
          const dy = center.y - currentCenter.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          // Weighting to prefer direct lines
          let penalty = 0;
          if (direction === 'up' || direction === 'down') {
            penalty = Math.abs(dx) * 2.5; // Stronger penalty for X deviation when moving Y
          } else {
            penalty = Math.abs(dy) * 2.5; // Stronger penalty for Y deviation when moving X
          }

          const score = distance + penalty;

          if (score < minDistance) {
            minDistance = score;
            bestCandidate = index;
          }
        }
      });

      return bestCandidate !== -1 ? bestCandidate : currentIndex;
    };

    const checkAxis = () => {
      const now = Date.now();
      const leftX = getAxis(0, 0); // Left stick X
      const leftY = getAxis(0, 1); // Left stick Y

      // Handle cover art selector navigation (grid layout)
      if (showCoverArtSelectorRef.current && availableCoversRef.current.length > 0) {
        const isMovingUp = leftY < -axisThreshold;
        const isMovingDown = leftY > axisThreshold;
        const isMovingLeft = leftX < -axisThreshold;
        const isMovingRight = leftX > axisThreshold;

        const wasMovingUp = lastAxisStateRef.current.y < -axisThreshold;
        const wasMovingDown = lastAxisStateRef.current.y > axisThreshold;
        const wasMovingLeft = lastAxisStateRef.current.x < -axisThreshold;
        const wasMovingRight = lastAxisStateRef.current.x > axisThreshold;

        const justStartedUp = isMovingUp && !wasMovingUp;
        const justStartedDown = isMovingDown && !wasMovingDown;
        const justStartedLeft = isMovingLeft && !wasMovingLeft;
        const justStartedRight = isMovingRight && !wasMovingRight;

        const timeSinceLastMove = now - lastAxisMoveRef.current;
        const canMoveAgain = timeSinceLastMove >= axisCooldown;

        if (canMoveAgain && (justStartedUp || justStartedDown || justStartedLeft || justStartedRight)) {
          const currentIndex = selectedCoverIndexRef.current;
          let direction = null;

          if (justStartedUp) direction = 'up';
          else if (justStartedDown) direction = 'down';
          else if (justStartedLeft) direction = 'left';
          else if (justStartedRight) direction = 'right';

          if (direction) {
            const newIndex = navigateGrid(currentIndex, direction, '.cover-art-item');
            if (newIndex !== currentIndex) {
              lastAxisMoveRef.current = now;
              selectedCoverIndexRef.current = newIndex;
              setSelectedCoverIndex(newIndex);
              console.log(`[Gamepad] Cover art: ${currentIndex} -> ${newIndex}`);
            }
          }
        }

        lastAxisStateRef.current = { x: leftX, y: leftY };
        return;
      }

      // Handle modal button navigation (horizontal layout)
      if (showGameDetailsRef.current) {
        const isMovingLeft = leftX < -axisThreshold;
        const isMovingRight = leftX > axisThreshold;
        const wasMovingLeft = lastAxisStateRef.current.x < -axisThreshold;
        const wasMovingRight = lastAxisStateRef.current.x > axisThreshold;

        const justStartedLeft = isMovingLeft && !wasMovingLeft;
        const justStartedRight = isMovingRight && !wasMovingRight;

        const timeSinceLastMove = now - lastAxisMoveRef.current;
        const canMoveAgain = timeSinceLastMove >= axisCooldown;

        if (canMoveAgain && (justStartedLeft || justStartedRight)) {
          const currentButton = modalButtonIndexRef.current;
          let newButton = currentButton;

          // 0 = Uninstall (left), 1 = Change Cover, 2 = Play (center), 3 = Close (right)
          if (isMovingRight && currentButton < 3) {
            newButton = currentButton + 1;
          } else if (isMovingLeft && currentButton > 0) {
            newButton = currentButton - 1;
          }

          if (newButton !== currentButton) {
            lastAxisMoveRef.current = now;
            modalButtonIndexRef.current = newButton;
            setModalButtonIndex(newButton);
            console.log(`[Gamepad] Modal button: ${currentButton} -> ${newButton}`);
          }
        }

        lastAxisStateRef.current = { x: leftX, y: leftY };
        return;
      }

      // Grid navigation (already have leftX and leftY from above)

      // Get current navigable items based on active tab using refs to avoid stale closures
      let maxItems = 0;
      let selector = '';
      const currentTab = activeTabRef.current;

      if (currentTab === 'steam') {
        maxItems = displayedGamesRef.current.length;
        selector = '.games-grid .game-card';
      } else if (currentTab === 'search') {
        if (searchResultsRef.current.length > 0 && showDropdown) {
          maxItems = searchResultsRef.current.length;
          selector = '.dropdown-item';
        } else {
          maxItems = torrentResultsRef.current.length;
          selector = 'tbody tr'; // Assuming torrent results are in a table
        }
      }

      if (maxItems === 0) {
        lastAxisStateRef.current = { x: leftX, y: leftY };
        return;
      }

      const currentIndex = controllerSelectedIndexRef.current;

      // Initialize selection if needed
      if (currentIndex < 0 || currentIndex >= maxItems) {
        if (currentIndex < 0) {
          controllerSelectedIndexRef.current = 0;
          setControllerSelectedIndex(0);
        } else {
          const clampedIndex = Math.min(maxItems - 1, Math.max(0, currentIndex));
          controllerSelectedIndexRef.current = clampedIndex;
          setControllerSelectedIndex(clampedIndex);
        }
        lastAxisStateRef.current = { x: leftX, y: leftY };
        return;
      }

      // Check for movement
      const isMovingUp = leftY < -axisThreshold;
      const isMovingDown = leftY > axisThreshold;
      const isMovingLeft = leftX < -axisThreshold;
      const isMovingRight = leftX > axisThreshold;

      const wasMovingUp = lastAxisStateRef.current.y < -axisThreshold;
      const wasMovingDown = lastAxisStateRef.current.y > axisThreshold;
      const wasMovingLeft = lastAxisStateRef.current.x < -axisThreshold;
      const wasMovingRight = lastAxisStateRef.current.x > axisThreshold;

      const justStartedUp = isMovingUp && !wasMovingUp;
      const justStartedDown = isMovingDown && !wasMovingDown;
      const justStartedLeft = isMovingLeft && !wasMovingLeft;
      const justStartedRight = isMovingRight && !wasMovingRight;

      const anyMove = isMovingUp || isMovingDown || isMovingLeft || isMovingRight;
      const wasAnyMove = wasMovingUp || wasMovingDown || wasMovingLeft || wasMovingRight;
      const justStopped = !anyMove && wasAnyMove;

      if (justStopped) {
        lastAxisMoveRef.current = 0;
      }

      const timeSinceLastMove = now - lastAxisMoveRef.current;
      const canMoveAgain = timeSinceLastMove >= axisCooldown;

      if (canMoveAgain && (justStartedUp || justStartedDown || justStartedLeft || justStartedRight || anyMove)) {
        let newIndex = currentIndex;
        let direction = null;

        // Prioritize new movements, then held directions
        if (justStartedUp || (isMovingUp && canMoveAgain)) direction = 'up';
        else if (justStartedDown || (isMovingDown && canMoveAgain)) direction = 'down';
        else if (justStartedLeft || (isMovingLeft && canMoveAgain)) direction = 'left';
        else if (justStartedRight || (isMovingRight && canMoveAgain)) direction = 'right';

        if (direction) {
          newIndex = navigateGrid(currentIndex, direction, selector);

          if (newIndex !== currentIndex) {
            lastAxisMoveRef.current = now;
            controllerSelectedIndexRef.current = newIndex;
            setControllerSelectedIndex(newIndex);
            console.log(`[Gamepad] Navigated ${direction}: ${currentIndex} -> ${newIndex}`);
          }
        }
      }

      lastAxisStateRef.current = { x: leftX, y: leftY };
    };

    // Check D-pad
    const checkDPad = () => {
      const now = Date.now();

      // Handle cover art selector navigation (grid layout)
      if (showCoverArtSelectorRef.current && availableCoversRef.current.length > 0) {
        const dPadUp = isButtonPressed(0, 12);
        const dPadDown = isButtonPressed(0, 13);
        const dPadLeft = isButtonPressed(0, 14);
        const dPadRight = isButtonPressed(0, 15);
        const dPadY = getAxis(0, 7);
        const dPadX = getAxis(0, 6);

        const dPadUpAxis = dPadY < -axisThreshold;
        const dPadDownAxis = dPadY > axisThreshold;
        const dPadLeftAxis = dPadX < -axisThreshold;
        const dPadRightAxis = dPadX > axisThreshold;

        const isUp = dPadUp || dPadUpAxis;
        const isDown = dPadDown || dPadDownAxis;
        const isLeft = dPadLeft || dPadLeftAxis;
        const isRight = dPadRight || dPadRightAxis;

        const prev = lastDPadStateRef.current;
        const upChanged = isUp !== prev.up;
        const downChanged = isDown !== prev.down;
        const leftChanged = isLeft !== prev.left;
        const rightChanged = isRight !== prev.right;

        if ((upChanged || downChanged || leftChanged || rightChanged) && (now - lastDPadMoveRef.current > axisCooldown)) {
          const currentIndex = selectedCoverIndexRef.current;
          let direction = null;

          if (isUp && !prev.up) direction = 'up';
          else if (isDown && !prev.down) direction = 'down';
          else if (isLeft && !prev.left) direction = 'left';
          else if (isRight && !prev.right) direction = 'right';

          if (direction) {
            const newIndex = navigateGrid(currentIndex, direction, '.cover-art-item');
            if (newIndex !== currentIndex) {
              lastDPadMoveRef.current = now;
              selectedCoverIndexRef.current = newIndex;
              setSelectedCoverIndex(newIndex);
              console.log(`[Gamepad] Cover art D-pad ${direction}: ${currentIndex} -> ${newIndex}`);
            }
          }
        }

        lastDPadStateRef.current = { up: isUp, down: isDown, left: isLeft, right: isRight };
        return;
      }

      // Handle modal button navigation (horizontal layout)
      if (showGameDetailsRef.current) {
        const dPadLeft = isButtonPressed(0, 14);
        const dPadRight = isButtonPressed(0, 15);
        const dPadX = getAxis(0, 6);

        const dPadLeftAxis = dPadX < -axisThreshold;
        const dPadRightAxis = dPadX > axisThreshold;

        const isLeft = dPadLeft || dPadLeftAxis;
        const isRight = dPadRight || dPadRightAxis;

        const prev = lastDPadStateRef.current;
        const leftChanged = isLeft !== prev.left;
        const rightChanged = isRight !== prev.right;

        if ((leftChanged || rightChanged) && (now - lastDPadMoveRef.current > axisCooldown)) {
          const currentButton = modalButtonIndexRef.current;
          let newButton = currentButton;

          // 0 = Uninstall (left), 1 = Change Cover, 2 = Play (center), 3 = Close (right)
          if (isRight && !prev.right && currentButton < 3) {
            newButton = currentButton + 1;
          } else if (isLeft && !prev.left && currentButton > 0) {
            newButton = currentButton - 1;
          }

          if (newButton !== currentButton) {
            lastDPadMoveRef.current = now;
            modalButtonIndexRef.current = newButton;
            setModalButtonIndex(newButton);
            console.log(`[Gamepad] Modal D-pad button: ${currentButton} -> ${newButton}`);
          }
        }

        lastDPadStateRef.current = { up: false, down: false, left: isLeft, right: isRight };
        return;
      }

      // Grid D-pad navigation

      let maxItems = 0;
      let selector = '';
      const currentTab = activeTabRef.current;

      if (currentTab === 'steam') {
        maxItems = displayedGamesRef.current.length;
        selector = '.games-grid .game-card';
      } else if (currentTab === 'search') {
        if (searchResultsRef.current.length > 0 && showDropdown) {
          maxItems = searchResultsRef.current.length;
          selector = '.dropdown-item';
        } else {
          maxItems = torrentResultsRef.current.length;
          selector = 'tbody tr';
        }
      }

      if (maxItems === 0) return;

      // Standard D-pad mapping
      const dPadUp = isButtonPressed(0, 12);
      const dPadDown = isButtonPressed(0, 13);
      const dPadLeft = isButtonPressed(0, 14);
      const dPadRight = isButtonPressed(0, 15);

      // Axis D-pad (some controllers)
      const dPadX = getAxis(0, 6);
      const dPadY = getAxis(0, 7);

      const dPadUpAxis = dPadY < -axisThreshold;
      const dPadDownAxis = dPadY > axisThreshold;
      const dPadLeftAxis = dPadX < -axisThreshold;
      const dPadRightAxis = dPadX > axisThreshold;

      const isUp = dPadUp || dPadUpAxis;
      const isDown = dPadDown || dPadDownAxis;
      const isLeft = dPadLeft || dPadLeftAxis;
      const isRight = dPadRight || dPadRightAxis;

      // Check state changes
      const prev = lastDPadStateRef.current;
      const upChanged = isUp !== prev.up;
      const downChanged = isDown !== prev.down;
      const leftChanged = isLeft !== prev.left;
      const rightChanged = isRight !== prev.right;

      if ((upChanged || downChanged || leftChanged || rightChanged) && (now - lastDPadMoveRef.current > axisCooldown)) {
        const currentIndex = controllerSelectedIndexRef.current < 0 ? 0 : controllerSelectedIndexRef.current;
        let direction = null;

        if (isUp && !prev.up) direction = 'up';
        else if (isDown && !prev.down) direction = 'down';
        else if (isLeft && !prev.left) direction = 'left';
        else if (isRight && !prev.right) direction = 'right';

        if (direction) {
          lastDPadMoveRef.current = now;
          const newIndex = navigateGrid(currentIndex, direction, selector);

          if (newIndex !== currentIndex) {
            controllerSelectedIndexRef.current = newIndex;
            setControllerSelectedIndex(newIndex);
            console.log(`[Gamepad] D-pad ${direction}: ${currentIndex} -> ${newIndex}`);
          }
        }
      }

      lastDPadStateRef.current = {
        up: isUp,
        down: isDown,
        left: isLeft,
        right: isRight
      };
    };

    // Handle A button (Select)
    onButtonPress(0, 0, () => {
      if (showCoverArtSelectorRef.current) {
        handleApplyCoverArt();
        return;
      }

      if (showGameDetailsRef.current) {
        const buttonIndex = modalButtonIndexRef.current;
        if (buttonIndex === 0) {
          handleUninstallGame();
        } else if (buttonIndex === 1) {
          handleOpenCoverArtSelector();
        } else if (buttonIndex === 2) {
          handlePlayGame();
        } else if (buttonIndex === 3) {
          setShowGameDetails(false);
        }
        return;
      }

      const currentTab = activeTabRef.current;
      if (currentTab === 'steam') {
        const index = controllerSelectedIndexRef.current;
        if (index >= 0 && index < displayedGamesRef.current.length) {
          handleGameClick(displayedGamesRef.current[index]);
        }
      } else if (currentTab === 'search') {
        // ... existing search logic ...
        const index = controllerSelectedIndexRef.current;
        if (searchResultsRef.current.length > 0 && showDropdown) {
          if (index >= 0 && index < searchResultsRef.current.length) {
            const game = searchResultsRef.current[index];
            setSelectedSearchGame(game);
            setTorrentResults([]);
            setShowDropdown(false);
            searchTorrentsForGame(game.name);
          }
        }
      }
    });
    onButtonPress(0, 1, () => { // B button (Xbox) / Circle (PlayStation) - Back
      if (showCoverArtSelectorRef.current) {
        handleCloseCoverArtSelector();
        return;
      }
      if (showSettingsRef.current) {
        setShowSettings(false);
        return;
      }
      if (showGameDetailsRef.current || showDownloadManager) {
        setShowGameDetails(false);
        setShowDownloadManager(false);
        // Don't reset index when closing modal - keep current selection
      }
    });

    onButtonPress(0, 4, () => { // L1 / LB button - Previous tab
      const tabs = ['steam', 'search'];
      const currentTabIndex = tabs.indexOf(activeTabRef.current);
      if (currentTabIndex > 0) {
        const newIndex = currentTabIndex - 1;
        setActiveTab(tabs[newIndex]);
        setControllerTabIndex(newIndex);
        controllerSelectedIndexRef.current = 0;
        setControllerSelectedIndex(0); // Reset to first item
      }
    });

    onButtonPress(0, 5, () => { // R1 / RB button - Next tab
      const tabs = ['steam', 'search'];
      const currentTabIndex = tabs.indexOf(activeTabRef.current);
      if (currentTabIndex < tabs.length - 1) {
        const newIndex = currentTabIndex + 1;
        setActiveTab(tabs[newIndex]);
        setControllerTabIndex(newIndex);
        controllerSelectedIndexRef.current = 0;
        setControllerSelectedIndex(0); // Reset to first item
      }
    });

    onButtonPress(0, 9, () => { // Start button - Toggle Settings
      setShowSettings(prev => !prev);
    });

    onButtonPress(0, 6, async () => { // L2 / LT - Toggle Fullscreen
      try {
        if (window.electronAPI?.toggleFullscreen) {
          const newFullscreenState = await window.electronAPI.toggleFullscreen();
          setIsFullscreen(newFullscreenState);
        }
      } catch (error) {
        console.error('Error toggling fullscreen with L2:', error);
      }
    });

    onButtonPress(0, 7, () => { // R2 / RT - Toggle Theme
      const currentTheme = themeRef.current;
      const newTheme = currentTheme === 'pc' ? 'tv' : 'pc';
      setTheme(newTheme);
      localStorage.setItem('theme', newTheme);
      document.body.className = newTheme === 'tv' ? 'tv-theme' : '';
    });

    // Poll axis movement and D-pad more frequently
    gamepadPollIntervalRef.current = setInterval(() => {
      try {
        checkAxis();
        checkDPad();
      } catch (error) {
        console.error('[Gamepad] Error in gamepad polling:', error);
      }
    }, 30); // Poll every 30ms for more responsive control

    return () => {
      if (gamepadPollIntervalRef.current) {
        clearInterval(gamepadPollIntervalRef.current);
        gamepadPollIntervalRef.current = null;
      }
    };
  }, [isConnected, getAxis, isButtonPressed, onButtonPress, handleGameClick, searchTorrentsForGame, handleOpenCoverArtSelector, handleApplyCoverArt, handleCloseCoverArtSelector]);


  // Listen for download progress updates
  useEffect(() => {
    if (!window.electronAPI) return;

    const handleProgress = async (progress) => {
      setDownloads(prev => {
        const index = prev.findIndex(d => d.infoHash === progress.infoHash);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = progress;
          return updated;
        } else {
          return [...prev, progress];
        }
      });

      // Check for completion
      if (progress.status === 'completed' && !handledDownloads.current.has(progress.infoHash)) {
        handledDownloads.current.add(progress.infoHash);

        if (confirm(`Download complete: ${progress.gameName}\n\nDo you want to install this game now?`)) {
          // 1. Launch Installer
          const installResult = await window.electronAPI.runInstaller(progress.savePath);

          if (!installResult.success) {
            alert('Could not find setup.exe automatically. Please check the download folder.');
            // await window.electronAPI.openPath(progress.savePath); // Optional: open folder
          }

          // 2. Add to Library
          const iFolder = await window.electronAPI.getInstallFolder();
          const img = await window.electronAPI.getGameImage(progress.gameName);

          await window.electronAPI.addCustomGame({
            name: progress.gameName,
            installPath: iFolder || '',
            executable: '',
            image: img
          });

          // Refresh library
          const updatedGames = await window.electronAPI.getGames();
          setGames(updatedGames);

          if (img) {
            setImages(prev => ({ ...prev, [updatedGames.find(g => g.name === progress.gameName)?.id]: img }));
          }

          alert(`${progress.gameName} has been added to your library!`);
        }
      }
    };

    window.electronAPI.onDownloadProgress(handleProgress);

    // Extraction progress listener
    window.electronAPI.onExtractionProgress((progress) => {
      setRdDownloads(prev => prev.map(d =>
        d.filename === progress.filename
          ? { ...d, status: 'extracting', percentage: progress.percent, loaded: progress.percent, total: 100 }
          : d
      ));
    });

  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <img
            src="/logo.png"
            alt="GC Game Launcher Logo"
            className="app-logo"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
          <h1 className="app-title">GC Game Launcher</h1>
          <nav className="nav-tabs">
            <button
              className={`nav-tab ${activeTab === 'steam' ? 'active' : ''} ${isConnected && controllerTabIndex === 0 ? 'controller-tab-selected' : ''}`}
              onClick={() => {
                setActiveTab('steam');
                setControllerTabIndex(0);
              }}
            >
              Game Library
            </button>
            <button
              className={`nav-tab ${activeTab === 'search' ? 'active' : ''} ${isConnected && controllerTabIndex === 1 ? 'controller-tab-selected' : ''}`}
              onClick={() => {
                setActiveTab('search');
                setControllerTabIndex(1);
              }}
            >
              Search Torrents
            </button>
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {isConnected && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: '#4ade80',
              fontSize: '0.85rem'
            }}>
              <span>🎮</span>
              <span>Controller Connected</span>
            </div>
          )}
          <button
            className="theme-toggle-btn"
            onClick={() => handleThemeChange(theme === 'pc' ? 'tv' : 'pc')}
            title={`Switch to ${theme === 'pc' ? 'TV' : 'PC'} Mode`}
          >
            {theme === 'pc' ? '🖥️' : '📺'}
          </button>
          <button className="settings-btn" onClick={() => setShowSettings(true)}>
            Settings
          </button>
          <button
            className="fullscreen-btn"
            onClick={async () => {
              try {
                console.log('Toggling fullscreen...');
                if (!window.electronAPI?.toggleFullscreen) {
                  console.error('toggleFullscreen API not available');
                  alert('Fullscreen API not available. Please restart the app.');
                  return;
                }
                const newFullscreenState = await window.electronAPI.toggleFullscreen();
                console.log('New fullscreen state:', newFullscreenState);
                setIsFullscreen(newFullscreenState);
              } catch (error) {
                console.error('Error toggling fullscreen:', error);
                alert('Error toggling fullscreen: ' + error.message);
              }
            }}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? '🗗' : '⛶'}
          </button>
        </div>
      </header>

      <main className="main-content">


        {!apiKey && (
          <div className="warning-banner">
            <p>⚠️ Please set your SteamGridDB API key to display game images</p>
          </div>
        )}

        {activeTab === 'steam' && (
          <>
            {loading ? (
              <div className="loading">Loading games...</div>
            ) : games.length === 0 ? (
              <div className="no-games">No Steam games found. Check the console for details.</div>
            ) : (
              <>
                <div className="games-grid">
                  {displayedGames.map((game, index) => {
                    const isSelected = isConnected && controllerSelectedIndex === index;
                    return (
                      <div
                        key={game.id}
                        className="game-wrapper"
                        onClick={() => handleGameClick(game)}
                        onMouseEnter={() => {
                          setControllerSelectedIndex(index);
                          controllerSelectedIndexRef.current = index;
                        }}
                      >
                        <div
                          className={`game-card ${isSelected ? 'controller-selected' : ''}`}
                          title={game.name}
                          style={{
                            backgroundImage: images[game.id]
                              ? `url(${images[game.id]})`
                              : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            backgroundSize: '100% 100%',
                            backgroundPosition: 'center',
                            cursor: 'pointer',
                            // Force visual update with inline style when selected
                            ...(isSelected ? {
                              transform: 'translateY(-8px) scale(1.05)',
                              boxShadow: '0 12px 30px rgba(102, 126, 234, 0.8), 0 0 20px rgba(102, 126, 234, 0.5)',
                              zIndex: 10,
                              position: 'relative'
                            } : {})
                          }}
                        >
                          {!images[game.id] && (
                            <div className="game-placeholder">
                              <span>{game.name}</span>
                            </div>
                          )}
                          {isSelected && (
                            <div style={{
                              position: 'absolute',
                              top: '10px',
                              right: '10px',
                              background: '#1b2838',
                              zIndex: 100,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '8px 12px',
                              borderRadius: '6px',
                              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)'
                            }}>
                              <img
                                src="https://store.fastly.steamstatic.com/public/shared/images/header/logo_steam.svg?t=962016"
                                alt="Steam"
                                style={{ width: '80px', height: 'auto' }}
                              />
                            </div>
                          )}
                        </div>
                        {theme === 'tv' && (
                          <div className="game-title-text" style={{
                            color: '#e0e0e0',
                            fontFamily: "'Nunito', sans-serif",
                            fontSize: '1.6rem',
                            fontWeight: '700',
                            textAlign: 'center',
                            maxWidth: '280px',
                            opacity: isSelected ? 1 : 0,
                            transition: 'opacity 0.3s ease',
                            marginTop: '8px'
                          }}>
                            {game.name}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

        {activeTab === 'search' && (
          <>
            <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
              {/* Search Input */}
              <div style={{ position: 'relative', marginBottom: '30px' }}>
                <input
                  type="text"
                  placeholder="Search for a game... (Press Enter to Search)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSearchGame(searchQuery);
                    }
                  }}
                  onFocus={() => {
                    if (searchResults.length > 1) setShowDropdown(true);
                  }}
                  onBlur={() => {
                    // Delay hiding to allow click to register
                    setTimeout(() => setShowDropdown(false), 200);
                  }}
                  style={{
                    width: '100%',
                    padding: '15px 20px',
                    fontSize: '18px',
                    border: '2px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: '#fff',
                    outline: 'none',
                    transition: 'all 0.3s ease'
                  }}
                // onFocus={(e) => e.target.style.borderColor = 'rgba(103, 126, 234, 0.5)'} // Move to CSS or inline if needed, but simpler here
                />

                {/* Search Suggestions Dropdown */}
                {showDropdown && searchResults.length > 1 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 100,
                    background: '#1a1a1a',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '0 0 12px 12px',
                    maxHeight: '300px',
                    overflowY: 'auto',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
                  }}>
                    {searchResults.map((game, index) => (
                      <div
                        key={game.id}
                        onClick={() => {
                          setSelectedSearchGame(game);
                          setTorrentResults([]); // Clear torrents initially
                          setShowDropdown(false);
                          searchTorrentsForGame(game.name); // Auto-search when selected
                        }}
                        className={`dropdown-item ${isConnected && controllerSelectedIndex === index ? 'controller-selected' : ''}`}
                        style={{
                          padding: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          cursor: 'pointer',
                          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                          background: selectedSearchGame?.id === game.id ? 'rgba(255, 255, 255, 0.1)' : 'transparent'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = selectedSearchGame?.id === game.id ? 'rgba(255, 255, 255, 0.1)' : 'transparent'}
                      >
                        {game.imageUrl && (
                          <img
                            src={game.imageUrl}
                            alt={game.name}
                            style={{ width: '40px', height: '60px', objectFit: 'cover', borderRadius: '4px' }}
                          />
                        )}
                        <span style={{ fontSize: '14px', color: '#fff' }}>{game.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected Game Info */}
              {selectedSearchGame && (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '12px',
                  padding: '20px',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '20px'
                }}>
                  {selectedSearchGame.imageUrl && (
                    <img
                      src={selectedSearchGame.imageUrl}
                      alt={selectedSearchGame.name}
                      style={{
                        width: '120px',
                        height: '180px',
                        objectFit: 'cover',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                        flexShrink: 0
                      }}
                    />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '10px' }}>
                      <h3 style={{ margin: '0', fontSize: '24px', color: '#fff' }}>
                        {selectedSearchGame.name}
                      </h3>
                      {gameDetails?.rating && gameDetails.rating !== 'N/A' && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          background: '#333',
                          padding: '5px 10px',
                          borderRadius: '6px',
                          border: '1px solid #444'
                        }}>
                          <img
                            src="https://upload.wikimedia.org/wikipedia/commons/c/ce/Metacritic_logo_original.svg"
                            alt="Metacritic"
                            style={{ width: '20px', height: '20px', marginRight: '8px' }}
                          />
                          <span style={{
                            fontWeight: 'bold',
                            fontSize: '18px',
                            color: parseInt(gameDetails.rating) >= 75 ? '#66cc33' : parseInt(gameDetails.rating) >= 50 ? '#ffcc33' : '#ff0000'
                          }}>
                            {gameDetails.rating}
                          </span>
                        </div>
                      )}
                    </div>

                    {selectedSearchGame.releaseDate && (
                      <p style={{ margin: '0 0 15px 0', color: 'rgba(255, 255, 255, 0.6)', fontSize: '14px' }}>
                        Released: {new Date(selectedSearchGame.releaseDate * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                      </p>
                    )}

                    {gameDetailsLoading ? (
                      <p style={{ color: 'rgba(255, 255, 255, 0.5)', fontStyle: 'italic' }}>Loading details...</p>
                    ) : (
                      <p style={{
                        margin: '0',
                        color: 'rgba(255, 255, 255, 0.8)',
                        lineHeight: '1.5',
                        fontSize: '15px',
                        maxWidth: '800px'
                      }}>
                        {gameDetails?.synopsis || 'No synopsis available.'}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Filter and Sort Controls */}
              {selectedSearchGame && (
                <div style={{
                  display: 'flex',
                  gap: '20px',
                  marginBottom: '20px',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    {['fitgirl', 'elamigos', 'rune', 'empress', 'tenoke', 'dodi'].map(repacker => (
                      <button
                        key={repacker}
                        onClick={() => {
                          setRepackFilter(prev =>
                            prev.includes(repacker)
                              ? prev.filter(r => r !== repacker)
                              : [...prev, repacker]
                          );
                        }}
                        style={{
                          padding: '8px 16px',
                          background: repackFilter.includes(repacker) ? '#66cc33' : 'rgba(255,255,255,0.1)',
                          border: 'none',
                          borderRadius: '20px',
                          color: '#fff',
                          cursor: 'pointer',
                          textTransform: 'capitalize',
                          transition: 'all 0.2s'
                        }}
                      >
                        {repacker}
                      </button>
                    ))}
                  </div>

                  <div>
                    <label style={{ marginRight: '10px', color: 'rgba(255, 255, 255, 0.8)' }}>Sort by:</label>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        color: '#fff',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="seeders">Seeders</option>
                      <option value="size">Size</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Loading State */}
              {searchLoading && (
                <div className="loading">Searching...</div>
              )}

              {/* Torrent Results */}
              {!searchLoading && torrentResults.length > 0 && (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '12px',
                  overflow: 'hidden'
                }}>
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse'
                  }}>
                    <thead>
                      <tr style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
                      }}>
                        <th style={{ padding: '15px', textAlign: 'left' }}>Name</th>
                        <th style={{ padding: '15px', textAlign: 'left' }}>Repacker</th>
                        <th style={{ padding: '15px', textAlign: 'center' }}>Size</th>
                        <th style={{ padding: '15px', textAlign: 'center' }}>Seeders</th>
                        <th style={{ padding: '15px', textAlign: 'center' }}>Leechers</th>
                        <th style={{ padding: '15px', textAlign: 'center' }}>Source</th>
                        <th style={{ padding: '15px', textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {torrentResults.map((torrent, index) => (
                        <tr
                          key={index}
                          style={{
                            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                            transition: 'background 0.2s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <td style={{ padding: '15px', maxWidth: '400px' }}>
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {torrent.name}
                            </div>
                          </td>
                          <td style={{ padding: '15px' }}>
                            <span style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              background: torrent.repacker === 'FitGirl' ? 'rgba(255, 105, 180, 0.2)' : 'rgba(100, 200, 255, 0.2)',
                              fontSize: '12px'
                            }}>
                              {torrent.repacker}
                            </span>
                          </td>
                          <td style={{ padding: '15px', textAlign: 'center' }}>{torrent.size}</td>
                          <td style={{ padding: '15px', textAlign: 'center', color: '#4ade80' }}>{torrent.seeders}</td>
                          <td style={{ padding: '15px', textAlign: 'center', color: '#f87171' }}>{torrent.leechers}</td>
                          <td style={{ padding: '15px', textAlign: 'center', fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)' }}>
                            {torrent.source}
                          </td>
                          <td style={{ padding: '15px', textAlign: 'center' }}>
                            <button
                              onClick={() => handleDownloadTorrent(torrent)}
                              className="btn-primary"
                              style={{
                                padding: '8px 16px',
                                fontSize: '14px',
                                background: (!torrent.magnetLink && torrent.ddlUrl) ? '#4a5568' : undefined
                              }}
                            >
                              {(!torrent.magnetLink && torrent.ddlUrl) ? 'Open Link' : 'Download'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* No Results */}
              {!searchLoading && searchQuery && torrentResults.length === 0 && selectedSearchGame && (
                <div className="no-games">
                  No torrents found for "{selectedSearchGame.name}". Try searching for a different game or check your filter settings.
                </div>
              )}

              {/* Instructions */}
              {!searchQuery && (
                <div style={{
                  textAlign: 'center',
                  padding: '60px 20px',
                  color: 'rgba(255, 255, 255, 0.5)'
                }}>
                  <h2 style={{ marginBottom: '10px' }}>Search for Game Torrents</h2>
                  <p>Enter a game name to search SteamGridDB and find FitGirl/ElAmigos repacks</p>
                </div>
              )}
            </div>
          </>
        )}


        {/* Download Manager */}
        {(downloads.length > 0 || rdDownloads.length > 0) && (
          <div className={`download-manager ${showDownloadManager ? 'expanded' : 'minimized'}`}>
            <div className="download-manager-header" onClick={() => setShowDownloadManager(!showDownloadManager)}>
              <h3>Downloads ({downloads.length + rdDownloads.length})</h3>
              <button className="toggle-btn">{showDownloadManager ? '▼' : '▲'}</button>
            </div>
            {showDownloadManager && (
              <div className="download-list">
                {/* Real-Debrid Downloads */}
                {rdDownloads.map((download, index) => (
                  <div key={`rd-${download.filename}-${index}`} className="download-item">
                    <div className="download-info">
                      <h4>{download.filename}</h4>
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{ width: `${download.percentage || 0}%` }}
                        ></div>
                      </div>
                      <div className="download-stats">
                        <span>
                          {download.status === 'preparing'
                            ? (download.progressStep || 'Preparing...')
                            : download.status === 'extracting'
                              ? 'Extracting...'
                              : (download.percentage || 0) + '%'
                          }
                        </span>
                        <span>
                          {download.status === 'preparing'
                            ? ''
                            : download.status === 'extracting'
                              ? `${Math.round(download.percentage)}%`
                              : `${((download.loaded || 0) / 1024 / 1024).toFixed(2)} MB / ${((download.total || 0) / 1024 / 1024).toFixed(2)} MB`
                          }
                        </span>
                        <span>Real-Debrid</span>
                      </div>
                    </div>
                    <div className="download-controls">
                      <button
                        onClick={async () => {
                          // Handle preparing state cancellation
                          if (download.status === 'preparing' && download.id) {
                            cancelledDownloads.current.add(download.id);
                          }

                          // Cancel the download
                          await window.electronAPI.rdCancelDownload(download.filename);
                          // Remove from UI
                          setRdDownloads(prev => prev.filter((_, i) => i !== index));
                        }}
                        className="btn-secondary"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ))}

                {/* WebTorrent Downloads */}
                {downloads.map((download) => (
                  <div key={download.infoHash} className="download-item">
                    <div className="download-info">
                      <h4>{download.gameName}</h4>
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{ width: `${download.progress}%` }}
                        ></div>
                      </div>
                      <div className="download-stats">
                        <span>{download.progress}%</span>
                        <span>↓ {(download.downloadSpeed / 1024 / 1024).toFixed(2)} MB/s</span>
                        <span>
                          Remaining: {((download.total - download.downloaded) / 1024 / 1024 / 1024).toFixed(2)} GB
                        </span>
                        <span>{download.status}</span>
                      </div>
                    </div>
                    <div className="download-controls">
                      {download.status === 'downloading' && (
                        <button onClick={() => window.electronAPI.pauseDownload(download.infoHash)}>Pause</button>
                      )}
                      {download.status === 'paused' && (
                        <button onClick={() => window.electronAPI.resumeDownload(download.infoHash)}>Resume</button>
                      )}
                      <button onClick={() => window.electronAPI.cancelDownload(download.infoHash)}>Cancel</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Settings</h2>
              <button className="close-btn" onClick={() => setShowSettings(false)}>×</button>
            </div>
            <div className="modal-body">
              <label htmlFor="api-key">SteamGridDB API Key</label>
              <input
                id="api-key"
                type="text"
                placeholder="Enter your API key"
                value={tempApiKey}
                onChange={(e) => setTempApiKey(e.target.value)}
              />
              <p className="help-text">
                Get your API key from <a href="https://www.steamgriddb.com/profile/preferences/api" target="_blank" rel="noopener noreferrer">SteamGridDB</a>
              </p>

              <div className="settings-section" style={{ marginTop: '20px', borderTop: '1px solid #333', paddingTop: '20px' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '10px' }}>Backloggd Integration</h3>
                {backloggdUser ? (
                  <p style={{ color: '#4caf50' }}>✓ Logged in as: <strong>{backloggdUser}</strong></p>
                ) : (
                  <button className="btn-secondary" onClick={handleBackloggdLogin}>
                    Login to Backloggd
                  </button>
                )}
              </div>

              <div className="settings-section" style={{ marginTop: '20px', borderTop: '1px solid #333', paddingTop: '20px' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '10px' }}>Real-Debrid Integration</h3>
                <label htmlFor="rd-api-key">Real-Debrid API Key</label>
                <input
                  id="rd-api-key"
                  type="text"
                  placeholder="Enter your Real-Debrid API key"
                  value={tempRdApiKey}
                  onChange={(e) => setTempRdApiKey(e.target.value)}
                />
                <p className="help-text">
                  Get your API key from <a href="https://real-debrid.com/apitoken" target="_blank" rel="noopener noreferrer">Real-Debrid</a>
                </p>
              </div>

              <div className="settings-section" style={{ marginTop: '20px', borderTop: '1px solid #333', paddingTop: '20px' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '10px' }}>VirusTotal Integration</h3>
                <label htmlFor="vt-api-key">VirusTotal API Key</label>
                <input
                  id="vt-api-key"
                  type="text"
                  placeholder="Enter your VirusTotal API key"
                  value={tempVirustotalApiKey}
                  onChange={(e) => setTempVirustotalApiKey(e.target.value)}
                />
                <p className="help-text">
                  Get your API key from <a href="https://www.virustotal.com/gui/my-apikey" target="_blank" rel="noopener noreferrer">VirusTotal</a>
                </p>
              </div>

              <div className="settings-section" style={{ marginTop: '20px', borderTop: '1px solid #333', paddingTop: '20px' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '10px' }}>Download Settings</h3>
                <div className="setting-group">
                  <label>Download Folder (FitGirl):</label>
                  <input
                    type="text"
                    value={tempDownloadFolder}
                    onChange={(e) => setTempDownloadFolder(e.target.value)}
                    placeholder="C:\Users\Name\Downloads\FitGirl Repacks"
                  />
                </div>

                <div className="setting-group">
                  <label>Install Folder (Library):</label>
                  <input
                    type="text"
                    value={tempInstallFolder}
                    onChange={(e) => setTempInstallFolder(e.target.value)}
                    placeholder="C:\Games"
                  />
                  <p className="setting-help">Where games will be installed (optional)</p>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowSettings(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSaveKey}>Save</button>
            </div>
          </div>
        </div>
      )}

      {showGameDetails && selectedGame && (
        <div className="modal-overlay" onClick={handleCloseGameDetails}>
          <div className="modal game-details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedGame.name}</h2>
              <button className="close-btn" onClick={handleCloseGameDetails}>×</button>
            </div>
            <div className="modal-body">
              <div className="game-details-content">
                {images[selectedGame.id] && (
                  <div className="game-cover">
                    <img src={images[selectedGame.id]} alt={selectedGame.name} />
                  </div>
                )}

                <div className="game-info-section">
                  <h3>Game Information</h3>
                  <p><strong>Platform:</strong> {selectedGame.platform}</p>
                  <p><strong>Install Directory:</strong> {selectedGame.installDir}</p>
                  {selectedGame.lastPlayed && (
                    <p><strong>Last Played:</strong> {new Date(parseInt(selectedGame.lastPlayed) * 1000).toLocaleDateString()}</p>
                  )}
                </div>

                <div className="game-info-section">
                  <h3>⏱️ Playtime</h3>
                  {playtimeData[selectedGame.id] ? (
                    <>
                      <p><strong>Total Hours:</strong> {(playtimeData[selectedGame.id].totalMinutes / 60).toFixed(1)} hrs</p>
                      <p><strong>Sessions:</strong> {playtimeData[selectedGame.id].sessions.length}</p>
                      {playtimeData[selectedGame.id].firstPlayed && (
                        <p><strong>First Played:</strong> {new Date(playtimeData[selectedGame.id].firstPlayed).toLocaleDateString()}</p>
                      )}
                      {playtimeData[selectedGame.id].currentSession && (
                        <div style={{ marginTop: '10px', padding: '10px', background: 'rgba(102, 126, 234, 0.1)', borderRadius: '8px' }}>
                          <p style={{ color: '#667eea', fontWeight: 'bold', marginBottom: '5px' }}>🎮 Session Active</p>
                          <button className="btn-secondary" onClick={() => handleEndSession(selectedGame.id)}>
                            Stop Session
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="placeholder-text">No playtime tracked yet</p>
                  )}
                </div>

                <div className="game-info-section">
                  <h3>📊 Backloggd</h3>
                  {gameRating ? (
                    <div className="rating-display" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                      <span className="rating-score" style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#667eea' }}>{gameRating}</span>
                      <span className="rating-label" style={{ color: '#888' }}>Average Rating</span>
                    </div>
                  ) : (
                    <p className="placeholder-text">Loading rating...</p>
                  )}
                  <button className="btn-secondary" style={{ marginTop: '5px', fontSize: '0.9rem' }} onClick={() => alert('Review feature coming soon!')}>
                    Write Backloggd Review
                  </button>
                </div>


              </div>
            </div>
            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
              <button
                className={`btn-danger ${modalButtonIndex === 0 ? 'controller-selected-button' : ''}`}
                onClick={handleUninstallGame}
              >
                🗑️ Uninstall
              </button>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  className={`btn-secondary ${modalButtonIndex === 1 ? 'controller-selected-button' : ''}`}
                  onClick={handleOpenCoverArtSelector}
                >
                  🎨 Change Cover
                </button>
                <button
                  className={`btn-primary btn-play ${modalButtonIndex === 2 ? 'controller-selected-button' : ''}`}
                  onClick={handlePlayGame}
                >
                  ▶ Play Game
                </button>
                <button
                  className={`btn-secondary ${modalButtonIndex === 3 ? 'controller-selected-button' : ''}`}
                  onClick={handleCloseGameDetails}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cover Art Selector Modal */}
      {showCoverArtSelector && (
        <div className="modal-overlay" onClick={handleCloseCoverArtSelector}>
          <div className="modal cover-art-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Select Cover Art</h2>
              <button className="close-btn" onClick={handleCloseCoverArtSelector}>×</button>
            </div>
            <div className="modal-body">
              {coversLoading ? (
                <div className="loading">Loading covers...</div>
              ) : availableCovers.length > 0 ? (
                <div className="cover-art-grid">
                  {availableCovers.map((coverUrl, index) => (
                    <div
                      key={index}
                      className={`cover-art-item ${selectedCoverIndex === index ? 'controller-selected' : ''}`}
                      onClick={() => {
                        setSelectedCoverIndex(index);
                        selectedCoverIndexRef.current = index;
                      }}
                    >
                      <img src={coverUrl} alt={`Cover ${index + 1}`} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-games">No alternative covers available</div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={handleCloseCoverArtSelector}>Cancel</button>
              <button
                className="btn-primary"
                onClick={handleApplyCoverArt}
                disabled={availableCovers.length === 0}
              >
                Apply Cover
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default App
