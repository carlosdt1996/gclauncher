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
  
  // Toast notifications
  const [toasts, setToasts] = useState([]);
  const toastIdCounter = useRef(0);
  
  // Confirmation modal
  const [confirmationModal, setConfirmationModal] = useState(null);
  const confirmationResolveRef = useRef(null);

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

  // Toast notification functions
  const showToast = useCallback((message, type = 'info', duration = 5000) => {
    const id = toastIdCounter.current++;
    const toast = { id, message, type, duration };
    setToasts(prev => [...prev, toast]);
    
    // Auto-remove after duration
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
    
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Confirmation modal function (replaces confirm())
  const showConfirmation = useCallback((message, title = 'Confirm') => {
    return new Promise((resolve) => {
      setConfirmationModal({ message, title });
      confirmationResolveRef.current = resolve;
    });
  }, []);

  const handleConfirmation = useCallback((result) => {
    if (confirmationResolveRef.current) {
      confirmationResolveRef.current(result);
      confirmationResolveRef.current = null;
    }
    setConfirmationModal(null);
  }, []);

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

          // Scan download folder for extracted installers
          try {
            console.log('[Frontend] Scanning download folder for installers...');
            const scanResult = await window.electronAPI.scanDownloadFolderForInstallers();
            console.log('[Frontend] Scan result:', scanResult);
            
            if (scanResult.success && scanResult.installers && scanResult.installers.length > 0) {
              console.log('[Frontend] Found extracted installers:', scanResult.installers);
              
              // Get current games list to check if already installed
              const currentGames = await window.electronAPI.getGames();
              const installedGameNames = new Set(currentGames.map(g => g.name.toLowerCase()));
              console.log('[Frontend] Installed games:', Array.from(installedGameNames));
              
              // Add each installer to rdDownloads with ready-to-install status
              // Only add if game is not already installed
              const installerEntries = scanResult.installers
                .filter(installer => {
                  const isInstalled = installedGameNames.has(installer.gameName.toLowerCase());
                  console.log(`[Frontend] Checking ${installer.gameName}: installed=${isInstalled}`);
                  return !isInstalled;
                })
                .map((installer, index) => ({
                  id: `extracted-installer-${Date.now()}-${index}`,
                  filename: installer.gameName,
                  gameName: installer.gameName,
                  status: 'ready-to-install',
                  percentage: 100,
                  extractedPath: installer.extractedPath,
                  downloadPaths: [] // No downloaded files, already extracted
                }));
              
              console.log(`[Frontend] Installer entries to add: ${installerEntries.length}`);
              
              if (installerEntries.length > 0) {
                setRdDownloads(prev => {
                  // Avoid duplicates by checking if gameName already exists
                  const existingNames = new Set(prev.map(d => d.gameName));
                  const newEntries = installerEntries.filter(e => !existingNames.has(e.gameName));
                  console.log(`[Frontend] Adding ${newEntries.length} new installer(s) to rdDownloads`);
                  const updated = [...prev, ...newEntries];
                  console.log(`[Frontend] Total rdDownloads after adding: ${updated.length}`);
                  
                  // Automatically expand Download Manager and show notification if there are installers ready
                  if (newEntries.length > 0) {
                    setTimeout(() => {
                      setShowDownloadManager(true);
                      console.log('[Frontend] Download Manager expanded automatically');
                      
                      // Show notification to user
                      const gameNames = newEntries.map(e => e.gameName).join(', ');
                      const message = newEntries.length === 1 
                        ? `¡Tienes 1 juego listo para instalar: ${gameNames}`
                        : `¡Tienes ${newEntries.length} juegos listos para instalar: ${gameNames}`;
                      showToast(message, 'success', 8000);
                    }, 500);
                  }
                  
                  return updated;
                });
                
                console.log(`[Frontend] Added ${installerEntries.length} installer(s) ready to install, Download Manager should be visible`);
              } else {
                console.log('[Frontend] All found installers are already installed');
              }
            } else {
              console.log('[Frontend] No installers found in download folder');
            }
          } catch (error) {
            console.error('[Frontend] Error scanning download folder for installers:', error);
          }

          // Listen for games updated event
          if (window.electronAPI.onGamesUpdated) {
            window.electronAPI.onGamesUpdated(async () => {
              console.log('[Frontend] Games updated, refreshing...');
              const updatedGames = await window.electronAPI.getGames();
              setGames(updatedGames);
              
              // Refresh images for new games
              if (key) {
                updatedGames.forEach(async (game) => {
                  const img = await window.electronAPI.getGameImage(game.id, game.name);
                  if (img) {
                    setImages(prev => ({ ...prev, [game.id]: img }));
                  }
                });
              }
            });
          }

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

        // Load Real-Debrid API key
        const rdKey = await window.electronAPI.getRdApiKey();
        if (rdKey) {
          setRdApiKey(rdKey);
          setTempRdApiKey(rdKey);
        }

        // Load download folder
        const dlFolder = await window.electronAPI.getDownloadFolder();
        if (dlFolder) {
          setDownloadFolder(dlFolder);
          setTempDownloadFolder(dlFolder);
        }

        // Load install folder
        const instFolder = await window.electronAPI.getInstallFolder();
        if (instFolder) {
          setInstallFolder(instFolder);
          setTempInstallFolder(instFolder);
        }

        // Load VirusTotal API key
        const vtKey = await window.electronAPI.getVirustotalApiKey();
        if (vtKey) {
          setVirustotalApiKey(vtKey);
          setTempVirustotalApiKey(vtKey);
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
        showToast('Login successful!', 'success');
      } else {
        showToast('Login failed or cancelled', 'error');
      }
    } catch (error) {
      console.error('Login error:', error);
      showToast('Login error', 'error');
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
        showToast('Failed to launch game: ' + error.message, 'error');
      }
    }
  };

  const handleUninstallGame = async () => {
    if (!selectedGame) return;

    const confirmMessage = selectedGame.platform === 'custom' && selectedGame.installDir
      ? `Are you sure you want to uninstall "${selectedGame.name}"?\n\nThis will:\n1. Look for and run the game's uninstaller\n2. Wait for uninstallation to complete\n3. Check if the game folder was removed\n4. Remove the game from your library`
      : `Are you sure you want to remove "${selectedGame.name}" from your library?\n\nThis will only remove it from your library. Game files will remain on your disk.`;

    const confirmed = await showConfirmation(confirmMessage, 'Uninstall Game');
    if (confirmed) {
      try {
        if (window.electronAPI && window.electronAPI.removeCustomGame) {
          showToast('Uninstalling game...', 'info');
          
          const result = await window.electronAPI.removeCustomGame(selectedGame.id);

          // Refresh the games list
          const updatedGames = await window.electronAPI.getGames();
          setGames(updatedGames);

          // Close the modal
          handleCloseGameDetails();

          if (result.success) {
            if (result.uninstallerUsed) {
              if (result.folderRemoved) {
                showToast(`"${selectedGame.name}" has been uninstalled and removed from your library.`, 'success');
              } else {
                showToast(`Uninstaller finished, but game folder still exists. Removed from library.`, 'warning');
              }
            } else {
              showToast(`"${selectedGame.name}" has been removed from your library.`, 'success');
            }
          } else {
            showToast(result.error || 'Uninstall completed with warnings.', 'warning');
          }
        } else {
          showToast('Uninstall feature is not available.', 'error');
        }
      } catch (error) {
        console.error('Error uninstalling game:', error);
        showToast('Failed to uninstall game: ' + error.message, 'error');
      }
    }
  };

  const handleOpenCoverArtSelector = useCallback(async () => {
    if (!selectedGame || !apiKey) {
      showToast('SteamGridDB API key is required to change cover art.', 'warning');
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
        showToast(result.error || 'No alternative covers found for this game.', 'warning');
      }
    } catch (error) {
      console.error('Error fetching covers:', error);
      setAvailableCovers([]);
      showToast('Error fetching covers: ' + error.message, 'error');
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
        showToast('Magnet link not found for this game', 'error');
      }
    } catch (error) {
      console.error('Error starting download:', error);
      showToast('Failed to start download: ' + error.message, 'error');
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
      showToast('Failed to load game details: ' + error.message, 'error');
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
        showToast('Failed to start download: ' + error.message, 'error');
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
            const confirmed = await showConfirmation(
              `⚠️ WARNING: VirusTotal flagged this torrent as malicious!\n\nDetections: ${maliciousCount}\nLink: ${scanResult.permalink}\n\nDo you want to continue downloading?`,
              'Security Warning'
            );
            if (!confirmed) {
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

      // Step 5: Get all unrestricted links
      updateStatus('Getting download links...', 90);

      const downloadLinks = [];
      let totalSize = 0;

      for (const link of torrentInfo.links) {
        const unrestrictResult = await window.electronAPI.rdGetUnrestrictedLink(link, rdApiKey);
        if (unrestrictResult.success) {
          downloadLinks.push(unrestrictResult.data);
          totalSize += unrestrictResult.data.filesize || 0;
        }
      }

      if (downloadLinks.length === 0) {
        throw new Error('Failed to get any download links');
      }

      // Step 6: Start downloads
      updateStatus('Starting downloads...', 100);

      // Remove the temporary "preparing" item
      setRdDownloads(prev => prev.filter(d => d.id !== downloadId));

      // Create a subfolder for the game to keep files together
      // Sanitize game name for folder creation
      const safeGameName = gameName.replace(/[^a-zA-Z0-9\s\-\[\]\(\)]/g, '').trim();

      // Construct the download path
      // If downloadFolder is not set, pass null to let backend use default
      let gameDownloadPath = null;

      console.log('[Frontend] Download folder value:', JSON.stringify(downloadFolder));
      console.log('[Frontend] Download folder type:', typeof downloadFolder);
      console.log('[Frontend] Download folder length:', downloadFolder ? downloadFolder.length : 'N/A');

      // Check if downloadFolder is actually set and not empty
      if (downloadFolder && typeof downloadFolder === 'string' && downloadFolder.trim().length > 0) {
        const separator = downloadFolder.includes('/') ? '/' : '\\';
        gameDownloadPath = `${downloadFolder}${downloadFolder.endsWith(separator) ? '' : separator}${safeGameName}`;
        console.log('[Frontend] Using custom download path:', gameDownloadPath);
      } else {
        console.log('[Frontend] Download folder not set, backend will use default');
      }

      let downloadedFiles = 0;
      let finalPath = null; // We'll use the folder path for extraction

      for (let i = 0; i < downloadLinks.length; i++) {
        const linkData = downloadLinks[i];

        // Add actual download entry
        const fileDownloadId = `${downloadId}-${i}`;

        setRdDownloads(prev => [...prev, {
          id: fileDownloadId,
          filename: linkData.filename,
          loaded: 0,
          total: linkData.filesize || 0,
          percentage: 0,
          status: 'downloading',
          gameName: gameName,
          image: image,
          progressStep: `File ${i + 1}/${downloadLinks.length}`
        }]);

        const downloadResult = await window.electronAPI.rdDownloadFile(
          linkData.download,
          linkData.filename,
          gameDownloadPath // Will be null if not set, backend will use default
        );

        if (!downloadResult.success) {
          throw new Error(`Failed to download file: ${linkData.filename} - ${downloadResult.error}`);
        }

        // Mark this file as completed and save the download path
        setRdDownloads(prev => prev.map(d =>
          d.id === fileDownloadId ? { 
            ...d, 
            status: 'completed', 
            percentage: 100,
            downloadPath: downloadResult.path // Save the downloaded file path
          } : d
        ));

        downloadedFiles++;
        // Keep track of the actual download path from the backend
        if (!finalPath && downloadResult.path) {
          // Extract the directory path from the file path
          const lastSeparator = Math.max(
            downloadResult.path.lastIndexOf('/'),
            downloadResult.path.lastIndexOf('\\')
          );
          finalPath = downloadResult.path.substring(0, lastSeparator);
        }
      }

      console.log('[Frontend] All downloads completed!');

      // Extraction Phase
      // We pass the FOLDER path to extractArchive. The backend will find the main archive.

      console.log('[Frontend] Starting extraction for folder:', finalPath);

      // Create output directory with game name
      // safeGameName is already declared earlier in this function, reuse it
      
      // Get the parent directory of finalPath (where the game folder should be)
      // Handle both Windows (\) and Unix (/) path separators
      const lastSeparator = Math.max(
        finalPath.lastIndexOf('\\'),
        finalPath.lastIndexOf('/')
      );
      const parentDir = lastSeparator !== -1 ? finalPath.substring(0, lastSeparator) : finalPath;
      
      // Create output path: parentDir/gameName
      // Use appropriate separator based on the path
      const separator = finalPath.includes('\\') ? '\\' : '/';
      const outputDir = parentDir + separator + safeGameName;
      
      console.log('[Frontend] Output directory for extraction:', outputDir);

      // Collect all download paths before consolidating
      const allDownloadPaths = [];
      setRdDownloads(prev => {
        prev.forEach(d => {
          if (d.gameName === gameName && d.status === 'completed' && d.downloadPath) {
            allDownloadPaths.push(d.downloadPath);
          }
        });
        return prev;
      });

      // Find the first completed download entry for this game and transition it to extraction
      // Remove other completed file downloads for the same game to consolidate
      setRdDownloads(prev => {
        let foundFirst = false;
        const updated = prev.map(d => {
          if (d.gameName === gameName && d.status === 'completed' && !foundFirst) {
            foundFirst = true;
            return {
              ...d,
              filename: gameName, // Use game name for the consolidated entry
              status: 'extracting',
              percentage: 0,
              loaded: 0,
              total: 100,
              progressStep: 'Extracting archive...',
              downloadPaths: allDownloadPaths // Store all download paths for later deletion
            };
          }
          // Remove other completed file downloads for the same game
          if (d.gameName === gameName && d.status === 'completed') {
            return null; // Mark for removal
          }
          return d;
        });
        // Filter out null entries
        return updated.filter(d => d !== null);
      });

      const extractResult = await window.electronAPI.extractArchive(finalPath, outputDir);

      if (extractResult.success) {
        const extractedPath = extractResult.outputDir;

        // Ensure window is visible and focused before showing confirmation
        if (window.electronAPI && window.electronAPI.restoreAndFocusWindow) {
          await window.electronAPI.restoreAndFocusWindow();
        }

        // Check if an ISO file was found
        let isoInstallFinished = false;
        let isoDrivePath = null; // Store ISO drive path for potential unmounting
        if (extractResult.isoFile) {
          console.log('[Frontend] ISO file detected:', extractResult.isoFile);
          // Extract filename from path (works in both Windows and Unix)
          const isoFileName = extractResult.isoFile.split(/[/\\]/).pop() || extractResult.isoFile;
          
          // Update status to ready-to-install with ISO info
          setRdDownloads(prev => prev.map(d =>
            d.gameName === gameName && d.status === 'extracting'
              ? { 
                  ...d, 
                  status: 'ready-to-install', 
                  percentage: 100,
                  extractedPath: extractedPath,
                  isoFile: extractResult.isoFile,
                  downloadPaths: d.downloadPaths || []
                }
              : d
          ));

          showToast(`ISO detectado: ${isoFileName}`, 'info');
          
          // Ask user if they want to mount ISO and install
          const shouldMountISO = await showConfirmation(
            `Se ha detectado un archivo ISO: ${isoFileName}\n\n¿Quieres montar el ISO e instalar el juego ahora?`,
            'Montar ISO e Instalar'
          );

          if (!shouldMountISO) {
            // User declined, keep as ready-to-install
            showToast(`El ISO está listo para montar cuando quieras.`, 'info');
            return;
          }

          // Get download paths from the download entry before updating status
          let downloadPathsToClean = [];
          let extractedPathToClean = extractedPath;
          setRdDownloads(prev => {
            const downloadEntry = prev.find(d => d.gameName === gameName && d.status === 'ready-to-install');
            if (downloadEntry) {
              downloadPathsToClean = downloadEntry.downloadPaths || [];
            }
            return prev.map(d =>
              d.gameName === gameName && d.status === 'ready-to-install'
                ? { 
                    ...d, 
                    status: 'mounting-iso', 
                    isoFile: extractResult.isoFile,
                    progressStep: 'Montando ISO...'
                  }
                : d
            );
          });

          // Mount ISO and run installer
          const isoInstallResult = await window.electronAPI.mountISOAndInstall(
            extractResult.isoFile,
            extractedPathToClean,
            downloadPathsToClean
          );
          
          if (isoInstallResult.success) {
            // Store drive path for potential unmounting if installation is cancelled
            isoDrivePath = isoInstallResult.drivePath;
            
            if (isoInstallResult.finished) {
              showToast(`Instalación desde ISO completada: ${gameName}`, 'success');
              isoInstallFinished = true;
              
              // Update status and wait a bit for files to be written
              setRdDownloads(prev => prev.map(d =>
                d.gameName === gameName && (d.status === 'installing-from-iso' || d.status === 'installing' || d.status === 'mounted-iso')
                  ? { 
                      ...d, 
                      status: 'verifying-installation',
                      progressStep: 'Verificando instalación...',
                      installerExecutable: isoInstallResult.installerExecutable || d.installerExecutable,
                      isoDrivePath: isoDrivePath // Store for potential unmount
                    }
                  : d
              ));
              
              // Wait a bit for files to be written after installer finishes
              console.log('[Frontend] Waiting 3 seconds for installation to complete...');
              await new Promise(resolve => setTimeout(resolve, 3000));
              
              // Continue with verification and cleanup as normal
              // Note: The ISO should be unmounted by the backend, but we keep isoDrivePath
              // in case we need to unmount it if verification fails
            } else {
              showToast(`Instalador desde ISO iniciado. El ISO se desmontará automáticamente cuando termine la instalación.`, 'info');
              // Store drive path for potential unmounting if installation is cancelled
              const drivePath = isoInstallResult.drivePath;
              
              // Update download entry with drive path
              setRdDownloads(prev => prev.map(d =>
                d.gameName === gameName && (d.status === 'mounting-iso' || d.status === 'mounted-iso' || d.status === 'installing-from-iso')
                  ? { ...d, isoDrivePath: drivePath }
                  : d
              ));
              
              // Set up a listener to check if installer finishes later
              // Also set a timeout to attempt unmount after reasonable time
              if (drivePath) {
                // Try to unmount after 10 minutes as a safety measure
                setTimeout(async () => {
                  console.log('[Frontend] Safety timeout: attempting to unmount ISO...');
                  try {
                    if (window.electronAPI && window.electronAPI.unmountISO) {
                      await window.electronAPI.unmountISO(drivePath);
                      console.log('[Frontend] ISO unmounted after safety timeout');
                    }
                  } catch (error) {
                    console.warn('[Frontend] Could not unmount ISO after timeout:', error);
                  }
                }, 600000); // 10 minutes
              }
              
              // Don't proceed with verification yet, wait for user to finish installation
              // Status will be updated by the ISO progress listener
              return;
            }
          } else {
            showToast(`Error al montar ISO: ${isoInstallResult.error}`, 'error');
            // Update status back to ready-to-install
            setRdDownloads(prev => prev.map(d =>
              d.gameName === gameName && (d.status === 'mounting-iso' || d.status === 'mounted-iso' || d.status === 'installing-from-iso')
                ? { 
                    ...d, 
                    status: 'ready-to-install', 
                    extractedPath: extractedPath,
                    downloadPaths: d.downloadPaths || []
                  }
                : d
            ));
            return;
          }
        }

        // Update the extraction entry to ready-to-install (only if not already updated by ISO handling)
        if (!extractResult.isoFile) {
          setRdDownloads(prev => prev.map(d =>
            d.gameName === gameName && d.status === 'extracting'
              ? { 
                  ...d, 
                  status: 'ready-to-install', 
                  percentage: 100,
                  extractedPath: extractedPath, // Store path for installation
                  downloadPaths: d.downloadPaths || [] // Preserve download paths for deletion
                }
              : d
          ));
        }

        showToast(`Download and extraction complete: ${gameName}`, 'success');

        // Ask user if they want to install the game (only if no ISO was processed)
        let shouldInstall = false;
        if (!extractResult.isoFile) {
          shouldInstall = await showConfirmation(
            `Extraction complete: ${gameName}\n\nThe game files have been extracted successfully.\n\nDo you want to install this game now?`,
            'Install Game'
          );
        } else {
          // If ISO was processed and installation finished, we already installed
          shouldInstall = true;
        }

        if (shouldInstall) {
          // Check if this was installed from ISO (skip runInstaller if so)
          const wasInstalledFromISO = extractResult.isoFile && isoInstallFinished;
          // Store isoDrivePath for potential unmounting if verification fails
          let currentIsoDrivePath = null;
          if (wasInstalledFromISO) {
            const isoDownloadEntry = rdDownloads.find(d => d.gameName === gameName && d.isoFile);
            currentIsoDrivePath = isoDownloadEntry?.isoDrivePath || null;
          }
          
          if (!wasInstalledFromISO) {
            // 1. Launch Installer (only if not installed from ISO)
            const installResult = await window.electronAPI.runInstaller(extractedPath);

            if (!installResult.success) {
              showToast('Could not find setup.exe automatically. Please check the download folder.', 'warning');
              return;
            }

            // 2. Wait for installer to finish (if it's still running)
            if (!installResult.finished) {
              console.log('[Frontend] Waiting for installer to finish...');
              // The backend already waits, but we check the result
              if (installResult.error) {
                console.warn('[Frontend] Installer may still be running:', installResult.error);
              }
            }

            // 3. Wait a bit for files to be written after installer finishes
            console.log('[Frontend] Waiting 3 seconds for installation to complete...');
            await new Promise(resolve => setTimeout(resolve, 3000));
          } else {
            // Already waited 3 seconds after ISO installation, status is already set to verifying-installation
            console.log('[Frontend] Installation from ISO completed, proceeding with verification...');
          }

          // 4. Verify that the game was actually installed
          // IMPORTANT: Only verify if installFolder is set. Without it, we cannot verify installation.
          let gameInstalled = false;
          let installPath = null;
          let gameExecutable = '';

          if (installFolder && installFolder.trim()) {
            // If install folder is set, scan it to see if the game was installed
            console.log('[Frontend] Verifying installation in install folder:', installFolder);
            
            // Try multiple times to find the game (it might take a moment to appear)
            let installedGame = null;
            let attempts = 0;
            const maxAttempts = 5;
            
            while (attempts < maxAttempts && !installedGame) {
              const scanResult = await window.electronAPI.scanInstallFolder();
              
              if (scanResult.success) {
                // Check if the game was found in the scan
                const updatedGames = await window.electronAPI.getGames();
                installedGame = updatedGames.find(g => 
                  g.name.toLowerCase() === gameName.toLowerCase() && 
                  g.platform === 'custom' &&
                  g.installDir &&
                  g.installDir.toLowerCase().startsWith(installFolder.toLowerCase())
                );
                
                if (installedGame) {
                  gameInstalled = true;
                  installPath = installedGame.installDir;
                  gameExecutable = installedGame.executable || '';
                  console.log('[Frontend] Game verified as installed:', installPath);
                  break;
                } else {
                  attempts++;
                  if (attempts < maxAttempts) {
                    console.log(`[Frontend] Game not found yet, waiting 2 seconds before retry ${attempts + 1}/${maxAttempts}...`);
                    // Update progress step
                    setRdDownloads(prev => prev.map(d =>
                      d.gameName === gameName && d.status === 'verifying-installation'
                        ? { 
                            ...d, 
                            progressStep: `Verificando instalación... (intento ${attempts + 1}/${maxAttempts})`
                          }
                        : d
                    ));
                    await new Promise(resolve => setTimeout(resolve, 2000));
                  }
                }
              } else {
                console.warn('[Frontend] Scan failed, retrying...');
                attempts++;
                if (attempts < maxAttempts) {
                  await new Promise(resolve => setTimeout(resolve, 2000));
                }
              }
            }
            
            if (!installedGame) {
              console.warn('[Frontend] Game not found in install folder after multiple attempts. Installation may have been cancelled or game installed to different location.');
            }
          } else {
            // No install folder configured - cannot verify installation
            // Do NOT add game to library automatically
            console.warn('[Frontend] No install folder set. Cannot verify installation. Game will NOT be added to library automatically.');
            console.warn('[Frontend] Please configure an install folder in settings, then manually scan for installed games.');
          }

          // 5. Only add to library and clean up if game was actually installed
          if (gameInstalled && installPath) {
            // Add to Library (only if game was verified as installed)
            await window.electronAPI.addCustomGame({
              name: gameName,
              installPath: installPath,
              executable: gameExecutable,
              addedAt: Date.now()
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

            // Clean up downloaded files and extraction folder after successful installation
            // Get download paths from the download entry (check multiple statuses)
            const downloadEntry = rdDownloads.find(d => 
              d.gameName === gameName && 
              (d.status === 'ready-to-install' || 
               d.status === 'verifying-installation' || 
               d.status === 'installing-from-iso' ||
               d.status === 'installing')
            );
            const downloadPaths = downloadEntry?.downloadPaths || [];
            
            // Delete downloaded RAR files
            if (downloadPaths.length > 0) {
              try {
                console.log('[Frontend] Deleting downloaded files:', downloadPaths);
                for (const filePath of downloadPaths) {
                  try {
                    await window.electronAPI.deleteDownloadedFile(filePath);
                    console.log('[Frontend] Deleted:', filePath);
                  } catch (deleteError) {
                    console.error('[Frontend] Error deleting file:', filePath, deleteError);
                  }
                }
              } catch (error) {
                console.error('[Frontend] Error deleting downloaded files:', error);
              }
            }

            // Delete extraction folder (where setup.exe was located)
            if (extractedPath && extractedPath !== installPath) {
              try {
                console.log('[Frontend] Deleting extraction folder:', extractedPath);
                const deleteFolderResult = await window.electronAPI.deleteDownloadedFolder(extractedPath);
                if (deleteFolderResult.success) {
                  console.log('[Frontend] Successfully deleted extraction folder:', extractedPath);
                } else {
                  console.warn('[Frontend] Failed to delete extraction folder:', deleteFolderResult.error);
                }
              } catch (error) {
                console.error('[Frontend] Error deleting extraction folder:', error);
              }
            }

            // Remove from downloads list (remove all entries for this game regardless of status)
            setRdDownloads(prev => prev.filter(d => d.gameName !== gameName));
            
            showToast(`Installation files cleaned up.`, 'info');
            showToast(`${gameName} has been added to your library!${gameExecutable ? `\n\nExecutable found: ${gameExecutable}` : '\n\nNote: No executable was auto-detected. You may need to set it manually in game settings.'}`, 'success');
          } else {
            // Installation was cancelled, failed, or cannot be verified - don't clean up, keep as ready-to-install
            
            // If this was an ISO installation, unmount the ISO
            const downloadEntry = rdDownloads.find(d => 
              d.gameName === gameName && 
              (d.status === 'ready-to-install' || 
               d.status === 'verifying-installation' || 
               d.status === 'installing-from-iso' ||
               d.status === 'installing' ||
               d.status === 'mounted-iso' ||
               d.status === 'mounting-iso')
            );
            
            // Check if this was an ISO installation (either from extractResult or downloadEntry)
            const wasISOInstallation = extractResult.isoFile || (downloadEntry && downloadEntry.isoFile);
            // Get isoDrivePath from multiple possible sources
            // Note: If isoInstallResult.finished was true, the backend already unmounted the ISO
            // so isoDrivePath might be null, but we still need to check if it's mounted
            const isoDrivePathToUnmount = downloadEntry?.isoDrivePath || 
                                         currentIsoDrivePath ||
                                         (extractResult.isoFile && !isoInstallFinished ? isoDrivePath : null);
            
            if (wasISOInstallation && isoDrivePathToUnmount) {
              console.log('[Frontend] Installation cancelled/failed, attempting to unmount ISO...');
              try {
                await window.electronAPI.unmountISO(isoDrivePathToUnmount);
                console.log('[Frontend] ISO unmounted successfully after cancelled installation');
                showToast('ISO desmontado correctamente.', 'info');
              } catch (unmountError) {
                console.warn('[Frontend] Could not unmount ISO (may already be unmounted):', unmountError);
                // ISO might already be unmounted by the backend, which is fine
              }
            } else if (wasISOInstallation && !isoDrivePathToUnmount) {
              // ISO installation but no drive path - backend already unmounted it
              console.log('[Frontend] ISO was already unmounted by backend after installer finished');
            }
            
            // Update status to ready-to-install and clear drive path
            setRdDownloads(prev => prev.map(d =>
              d.gameName === gameName && (d.status === 'verifying-installation' || d.status === 'installing-from-iso' || d.status === 'installing' || d.status === 'mounted-iso' || d.status === 'mounting-iso')
                ? { 
                    ...d, 
                    status: 'ready-to-install',
                    isoDrivePath: undefined, // Clear drive path
                    progressStep: undefined // Clear progress step
                  }
                : d
            ));
            
            if (!installFolder || !installFolder.trim()) {
              console.warn('[Frontend] Cannot verify installation: No install folder configured.');
              showToast(`No se pudo verificar la instalación. Por favor, configura una carpeta de instalación en Configuración y luego escanea manualmente para encontrar juegos instalados.`, 'warning');
            } else {
              console.warn('[Frontend] Game installation was not verified. Keeping files and status as ready-to-install.');
              const isoMessage = wasISOInstallation ? ' El ISO ha sido desmontado.' : '';
              showToast(`La instalación fue cancelada o no se pudo verificar.${isoMessage} Puedes intentar instalar de nuevo.`, 'warning');
            }
            // Status remains as 'ready-to-install', so user can try again
          }
        }
      } else {
        console.error('[Frontend] Extraction failed:', extractResult.error);
        setRdDownloads(prev => prev.map(d =>
          d.gameName === gameName && d.status === 'extracting'
            ? { ...d, status: 'error', error: extractResult.error }
            : d
        ));
        showToast('Extraction failed: ' + extractResult.error, 'error');
      }
    } catch (error) {
      console.error('[Frontend] Error downloading game:', error);
      // Remove the preparing item if it exists
      setRdDownloads(prev => prev.filter(d => d.id !== downloadId)); // Use ID to be safe

      if (error.message !== 'Download cancelled by user') {
        showToast('Failed to start download: ' + error.message, 'error');
      }
    }
  };

  const handleDownloadFitgirlGame = async () => {
    if (!fitgirlGameDetails || !fitgirlGameDetails.magnetLink) {
      showToast('Magnet link not found for this game', 'error');
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
          showToast('Please set your SteamGridDB API Key in Settings to use the search.', 'warning');
          setShowSettings(true);
        } else {
          showToast(`Search failed: ${result.error}`, 'error');
        }
      }
    } catch (error) {
      console.error('[Search] Error:', error);
      setSearchResults([]);
      showToast('An error occurred while searching.', 'error');
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
      showToast('No magnet link available for this torrent', 'error');
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

        const shouldInstall = await showConfirmation(`Download complete: ${progress.gameName}\n\nDo you want to install this game now?`, 'Install Game');
        if (shouldInstall) {
          // 1. Launch Installer
          const installResult = await window.electronAPI.runInstaller(progress.savePath);

          if (!installResult.success) {
            showToast('Could not find setup.exe automatically. Please check the download folder.', 'warning');
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

          showToast(`${progress.gameName} has been added to your library!`, 'success');
        }
      }
    };

    window.electronAPI.onDownloadProgress(handleProgress);

    // Extraction progress listener
    window.electronAPI.onExtractionProgress((progress) => {
      setRdDownloads(prev => prev.map(d => {
        // Match by gameName if available, otherwise fall back to filename
        const matches = progress.gameName
          ? d.gameName === progress.gameName
          : d.filename === progress.filename || d.filename === progress.gameName;
        
        // Only update if status is 'extracting' - don't override 'ready-to-install' or other states
        if (matches && d.status === 'extracting') {
          return {
            ...d,
            status: 'extracting',
            percentage: progress.percent || 0,
            loaded: progress.percent || 0,
            total: 100
          };
        }
        return d;
      }));
    });

    // ISO progress listener
    if (window.electronAPI.onISOProgress) {
      window.electronAPI.onISOProgress((progress) => {
        setRdDownloads(prev => prev.map(d => {
          // Update downloads that have an ISO file and are in installing state
          if (d.isoFile && (d.status === 'installing' || d.status === 'mounting-iso')) {
            let newStatus = d.status;
            let progressStep = d.progressStep || '';
            
            switch (progress.stage) {
              case 'mounting':
                newStatus = 'mounting-iso';
                progressStep = 'Montando ISO...';
                break;
              case 'mounted':
                newStatus = 'mounted-iso';
                progressStep = 'ISO montado. Buscando instalador...';
                break;
              case 'installing':
                newStatus = 'installing-from-iso';
                progressStep = `Ejecutando instalador: ${progress.installerPath ? progress.installerPath.split(/[/\\]/).pop() : 'setup.exe'}`;
                break;
              case 'finished':
                newStatus = 'installing';
                progressStep = 'Instalación completada. Verificando...';
                break;
              case 'error':
                newStatus = 'ready-to-install';
                progressStep = `Error: ${progress.message}`;
                break;
            }
            
            return {
              ...d,
              status: newStatus,
              progressStep: progressStep,
              isoDrivePath: progress.drivePath || d.isoDrivePath,
              installerExecutable: progress.installerPath ? progress.installerPath.split(/[/\\]/).pop() : d.installerExecutable
            };
          }
          return d;
        }));
      });
    }

  }, []);

  // Debug: Log rdDownloads changes
  useEffect(() => {
    console.log('[Frontend] rdDownloads state changed:', rdDownloads.length, 'items');
    if (rdDownloads.length > 0) {
      console.log('[Frontend] rdDownloads items:', rdDownloads.map(d => ({ 
        gameName: d.gameName, 
        status: d.status, 
        extractedPath: d.extractedPath 
      })));
    }
    console.log('[Frontend] showDownloadManager:', showDownloadManager);
    console.log('[Frontend] downloads.length:', downloads.length, 'rdDownloads.length:', rdDownloads.length);
  }, [rdDownloads, showDownloadManager, downloads]);

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
                  showToast('Fullscreen API not available. Please restart the app.', 'error');
                  return;
                }
                const newFullscreenState = await window.electronAPI.toggleFullscreen();
                console.log('New fullscreen state:', newFullscreenState);
                setIsFullscreen(newFullscreenState);
              } catch (error) {
                console.error('Error toggling fullscreen:', error);
                showToast('Error toggling fullscreen: ' + error.message, 'error');
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
          <div 
            className={`download-manager ${showDownloadManager ? 'expanded' : 'minimized'}`} 
            style={{ 
              display: 'block',
              visibility: 'visible',
              opacity: 1
            }}
          >
            <div className="download-manager-header" onClick={() => setShowDownloadManager(!showDownloadManager)}>
              <h3>Downloads ({downloads.length + rdDownloads.length})</h3>
              {rdDownloads.some(d => d.status === 'ready-to-install') && (
                <span style={{ 
                  color: '#4caf50', 
                  fontSize: '0.85rem', 
                  marginRight: '10px',
                  fontWeight: 'bold'
                }}>
                  ⚠️ {rdDownloads.filter(d => d.status === 'ready-to-install').length} ready to install
                </span>
              )}
              <button className="toggle-btn">{showDownloadManager ? '▼' : '▲'}</button>
            </div>
            {showDownloadManager && (
              <div className="download-list">
                {/* Real-Debrid Downloads */}
                {rdDownloads.map((download, index) => (
                  <div key={`rd-${download.filename}-${index}`} className="download-item">
                    <div className="download-info">
                      <h4>{download.filename || download.gameName}</h4>
                      {download.status === 'ready-to-install' ? (
                        <div style={{ 
                          padding: '10px', 
                          background: 'rgba(76, 175, 80, 0.1)', 
                          borderRadius: '6px',
                          margin: '10px 0',
                          border: '1px solid rgba(76, 175, 80, 0.3)'
                        }}>
                          <p style={{ margin: 0, color: '#4caf50', fontWeight: 'bold' }}>
                            ✓ Ready to Install
                          </p>
                        </div>
                      ) : download.status === 'mounting-iso' ? (
                        <div style={{ 
                          padding: '10px', 
                          background: 'rgba(255, 193, 7, 0.1)', 
                          borderRadius: '6px',
                          margin: '10px 0',
                          border: '1px solid rgba(255, 193, 7, 0.3)'
                        }}>
                          <p style={{ margin: 0, color: '#ffc107', fontWeight: 'bold' }}>
                            💿 Montando ISO...
                          </p>
                          {download.progressStep && (
                            <p style={{ margin: '5px 0 0 0', fontSize: '0.85rem', color: 'rgba(255, 193, 7, 0.8)' }}>
                              {download.progressStep}
                            </p>
                          )}
                        </div>
                      ) : download.status === 'mounted-iso' ? (
                        <div style={{ 
                          padding: '10px', 
                          background: 'rgba(76, 175, 80, 0.1)', 
                          borderRadius: '6px',
                          margin: '10px 0',
                          border: '1px solid rgba(76, 175, 80, 0.3)'
                        }}>
                          <p style={{ margin: 0, color: '#4caf50', fontWeight: 'bold' }}>
                            💿 ISO Montado
                          </p>
                          {download.progressStep && (
                            <p style={{ margin: '5px 0 0 0', fontSize: '0.85rem', color: 'rgba(76, 175, 80, 0.8)' }}>
                              {download.progressStep}
                            </p>
                          )}
                        </div>
                      ) : download.status === 'installing-from-iso' ? (
                        <div style={{ 
                          padding: '10px', 
                          background: 'rgba(102, 126, 234, 0.1)', 
                          borderRadius: '6px',
                          margin: '10px 0',
                          border: '1px solid rgba(102, 126, 234, 0.3)'
                        }}>
                          <p style={{ margin: 0, color: '#667eea', fontWeight: 'bold' }}>
                            💿 Instalando desde ISO...
                          </p>
                          {download.progressStep && (
                            <p style={{ margin: '5px 0 0 0', fontSize: '0.85rem', color: 'rgba(102, 126, 234, 0.8)' }}>
                              {download.progressStep}
                            </p>
                          )}
                        </div>
                      ) : download.status === 'verifying-installation' ? (
                        <div style={{ 
                          padding: '10px', 
                          background: 'rgba(156, 39, 176, 0.1)', 
                          borderRadius: '6px',
                          margin: '10px 0',
                          border: '1px solid rgba(156, 39, 176, 0.3)'
                        }}>
                          <p style={{ margin: 0, color: '#9c27b0', fontWeight: 'bold' }}>
                            🔍 Verificando instalación...
                          </p>
                          {download.progressStep && (
                            <p style={{ margin: '5px 0 0 0', fontSize: '0.85rem', color: 'rgba(156, 39, 176, 0.8)' }}>
                              {download.progressStep}
                            </p>
                          )}
                        </div>
                      ) : download.status === 'installing' ? (
                        <div style={{ 
                          padding: '10px', 
                          background: 'rgba(102, 126, 234, 0.1)', 
                          borderRadius: '6px',
                          margin: '10px 0',
                          border: '1px solid rgba(102, 126, 234, 0.3)'
                        }}>
                          <p style={{ margin: 0, color: '#667eea', fontWeight: 'bold' }}>
                            Installing...
                          </p>
                        </div>
                      ) : (
                        <>
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
                        </>
                      )}
                    </div>
                    <div className="download-controls">
                      {download.status === 'ready-to-install' ? (
                        <button
                          onClick={async () => {
                            try {
                              const extractedPath = download.extractedPath;
                              const isoFile = download.isoFile;
                              
                              // Check if this is an ISO file
                              if (isoFile) {
                                // Get download paths and extracted path from the download entry
                                const downloadPathsToClean = download.downloadPaths || [];
                                const extractedPathToClean = download.extractedPath || extractedPath;
                                
                                // Update status to mounting-iso
                                setRdDownloads(prev => prev.map((d, i) => 
                                  i === index ? { ...d, status: 'mounting-iso', progressStep: 'Montando ISO...' } : d
                                ));

                                // Mount ISO and run installer
                                const isoInstallResult = await window.electronAPI.mountISOAndInstall(
                                  isoFile,
                                  extractedPathToClean,
                                  downloadPathsToClean
                                );
                                
                                if (!isoInstallResult.success) {
                                  showToast(`Error al montar ISO: ${isoInstallResult.error}`, 'error');
                                  setRdDownloads(prev => prev.map((d, i) => 
                                    i === index ? { ...d, status: 'ready-to-install' } : d
                                  ));
                                  return;
                                }

                                // Store drive path for potential unmounting if installation is cancelled
                                const isoDrivePath = isoInstallResult.drivePath;

                                if (isoInstallResult.finished) {
                                  // Installation finished, continue with verification
                                  setRdDownloads(prev => prev.map((d, i) => 
                                    i === index ? { 
                                      ...d, 
                                      status: 'verifying-installation',
                                      progressStep: 'Verificando instalación...',
                                      installerExecutable: isoInstallResult.installerExecutable || d.installerExecutable,
                                      isoDrivePath: isoDrivePath // Store for potential unmount
                                    } : d
                                  ));
                                  
                                  // Wait a bit for files to be written
                                  await new Promise(resolve => setTimeout(resolve, 3000));
                                  // Continue to verification below
                                } else {
                                  showToast(`Instalador desde ISO iniciado. El ISO se desmontará automáticamente cuando termine la instalación.`, 'info');
                                  // Store drive path for potential unmounting
                                  setRdDownloads(prev => prev.map((d, i) => 
                                    i === index ? { ...d, isoDrivePath: isoDrivePath } : d
                                  ));
                                  // Don't proceed with verification yet
                                  return;
                                }
                              } else {
                                // Regular installer (not ISO)
                                // Update status to installing
                                setRdDownloads(prev => prev.map((d, i) => 
                                  i === index ? { ...d, status: 'installing' } : d
                                ));

                                if (!extractedPath) {
                                  showToast('Extracted path not found', 'error');
                                  setRdDownloads(prev => prev.map((d, i) => 
                                    i === index ? { ...d, status: 'ready-to-install' } : d
                                  ));
                                  return;
                                }

                                // Launch Installer
                                const installResult = await window.electronAPI.runInstaller(extractedPath);

                                if (!installResult.success) {
                                  showToast('Could not find setup.exe automatically. Please check the download folder.', 'warning');
                                  setRdDownloads(prev => prev.map((d, i) => 
                                    i === index ? { ...d, status: 'ready-to-install' } : d
                                  ));
                                  return;
                                }

                                // Wait a bit for files to be written after installer finishes
                                await new Promise(resolve => setTimeout(resolve, 3000));
                              }

                              // Verification code (runs for both ISO and regular installers)

                              // Verify that the game was actually installed
                              const gameNameForInstall = download.gameName || download.filename;
                              let gameInstalled = false;
                              let installPath = null;
                              let gameExecutable = '';

                              if (installFolder && installFolder.trim()) {
                                // If install folder is set, scan it to see if the game was installed
                                console.log('[Frontend] Verifying installation in install folder:', installFolder);
                                const scanResult = await window.electronAPI.scanInstallFolder();
                                
                                if (scanResult.success) {
                                  // Check if the game was found in the scan
                                  const updatedGames = await window.electronAPI.getGames();
                                  const installedGame = updatedGames.find(g => 
                                    g.name.toLowerCase() === gameNameForInstall.toLowerCase() && 
                                    g.platform === 'custom' &&
                                    g.installDir &&
                                    g.installDir.toLowerCase().startsWith(installFolder.toLowerCase())
                                  );
                                  
                                  if (installedGame) {
                                    gameInstalled = true;
                                    installPath = installedGame.installDir;
                                    gameExecutable = installedGame.executable || '';
                                    console.log('[Frontend] Game verified as installed:', installPath);
                                  } else {
                                    console.warn('[Frontend] Game not found in install folder after installation. Installation may have been cancelled.');
                                  }
                                }
                              } else {
                                // No install folder configured - cannot verify installation
                                // Do NOT add game to library automatically
                                console.warn('[Frontend] No install folder set. Cannot verify installation. Game will NOT be added to library automatically.');
                                console.warn('[Frontend] Please configure an install folder in settings, then manually scan for installed games.');
                              }

                              // Only add to library and clean up if game was actually installed
                              if (gameInstalled && installPath) {
                                // Add to Library (only if game was verified as installed)
                                await window.electronAPI.addCustomGame({
                                  name: gameNameForInstall,
                                  installPath: installPath,
                                  executable: gameExecutable,
                                  addedAt: Date.now()
                                });

                                // Refresh library
                                const updatedGames = await window.electronAPI.getGames();
                                setGames(updatedGames);

                                // Fetch SteamGridDB image if needed
                                if (apiKey) {
                                  const img = await window.electronAPI.getGameImage(gameNameForInstall);
                                  if (img) {
                                    setImages(prev => ({ ...prev, [updatedGames.find(g => g.name === gameNameForInstall)?.id]: img }));
                                  }
                                }

                                // Clean up downloaded files and extraction folder after successful installation
                                // Delete downloaded RAR files
                                const downloadPaths = download.downloadPaths || [];
                                if (downloadPaths.length > 0) {
                                  try {
                                    console.log('[Frontend] Deleting downloaded files:', downloadPaths);
                                    for (const filePath of downloadPaths) {
                                      try {
                                        await window.electronAPI.deleteDownloadedFile(filePath);
                                        console.log('[Frontend] Deleted:', filePath);
                                      } catch (deleteError) {
                                        console.error('[Frontend] Error deleting file:', filePath, deleteError);
                                      }
                                    }
                                  } catch (error) {
                                    console.error('[Frontend] Error deleting downloaded files:', error);
                                  }
                                }

                                // Delete extraction folder (where setup.exe was located)
                                if (extractedPath && extractedPath !== installPath) {
                                  try {
                                    console.log('[Frontend] Deleting extraction folder:', extractedPath);
                                    const deleteFolderResult = await window.electronAPI.deleteDownloadedFolder(extractedPath);
                                    if (deleteFolderResult.success) {
                                      console.log('[Frontend] Successfully deleted extraction folder:', extractedPath);
                                    } else {
                                      console.warn('[Frontend] Failed to delete extraction folder:', deleteFolderResult.error);
                                    }
                                  } catch (error) {
                                    console.error('[Frontend] Error deleting extraction folder:', error);
                                  }
                                }

                                showToast(`Installation files cleaned up.`, 'info');
                                // Remove from downloads list
                                setRdDownloads(prev => prev.filter((_, i) => i !== index));
                                showToast(`${download.gameName || download.filename} has been installed and added to your library!${gameExecutable ? `\n\nExecutable found: ${gameExecutable}` : '\n\nNote: No executable was auto-detected. You may need to set it manually in game settings.'}`, 'success');
                              } else {
                                // Installation was cancelled, failed, or cannot be verified - don't clean up, keep as ready-to-install
                                
                                // If this was an ISO installation, unmount the ISO
                                const currentDownload = rdDownloads[index];
                                if (currentDownload && currentDownload.isoFile && currentDownload.isoDrivePath) {
                                  console.log('[Frontend] Installation cancelled/failed, unmounting ISO...');
                                  try {
                                    await window.electronAPI.unmountISO(currentDownload.isoDrivePath);
                                    console.log('[Frontend] ISO unmounted successfully after cancelled installation');
                                    showToast('ISO desmontado correctamente.', 'info');
                                  } catch (unmountError) {
                                    console.warn('[Frontend] Could not unmount ISO:', unmountError);
                                  }
                                }
                                
                                if (!installFolder || !installFolder.trim()) {
                                  console.warn('[Frontend] Cannot verify installation: No install folder configured.');
                                  showToast(`No se pudo verificar la instalación. Por favor, configura una carpeta de instalación en Configuración y luego escanea manualmente para encontrar juegos instalados.`, 'warning');
                                } else {
                                  console.warn('[Frontend] Game installation was not verified. Keeping files and status as ready-to-install.');
                                  showToast(`La instalación fue cancelada o no se pudo verificar. El ISO ha sido desmontado. Puedes intentar instalar de nuevo.`, 'warning');
                                }
                                // Reset status back to ready-to-install (keep isoFile for future attempts)
                                setRdDownloads(prev => prev.map((d, i) => 
                                  i === index ? { 
                                    ...d, 
                                    status: 'ready-to-install',
                                    isoDrivePath: undefined // Clear drive path
                                  } : d
                                ));
                              }
                            } catch (error) {
                              console.error('Error installing game:', error);
                              showToast('Error installing game: ' + error.message, 'error');
                              setRdDownloads(prev => prev.map((d, i) => 
                                i === index ? { ...d, status: 'ready-to-install' } : d
                              ));
                            }
                          }}
                          className="btn-primary"
                        >
                          {download.isoFile ? '💿 Montar ISO e Instalar' : '📦 Instalar'}
                        </button>
                      ) : download.status === 'mounting-iso' || download.status === 'mounted-iso' || download.status === 'installing-from-iso' || download.status === 'verifying-installation' ? (
                        <button className="btn-secondary" disabled>
                          {download.status === 'mounting-iso' && '💿 Montando ISO...'}
                          {download.status === 'mounted-iso' && '💿 Buscando instalador...'}
                          {download.status === 'installing-from-iso' && '💿 Instalando...'}
                          {download.status === 'verifying-installation' && '🔍 Verificando...'}
                        </button>
                      ) : download.status === 'installing' ? (
                        <button className="btn-secondary" disabled>
                          Installing...
                        </button>
                      ) : (
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
                      )}
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
                  <button 
                    className="btn-secondary" 
                    onClick={async () => {
                      try {
                        showToast('Scanning download folder for installers...', 'info');
                        console.log('[Frontend] Manual scan triggered');
                        const scanResult = await window.electronAPI.scanDownloadFolderForInstallers();
                        console.log('[Frontend] Manual scan result:', scanResult);
                        
                        if (scanResult.success && scanResult.installers && scanResult.installers.length > 0) {
                          console.log('[Frontend] Found extracted installers:', scanResult.installers);
                          
                          // Get current games list to check if already installed
                          const currentGames = await window.electronAPI.getGames();
                          const installedGameNames = new Set(currentGames.map(g => g.name.toLowerCase()));
                          console.log('[Frontend] Installed games:', Array.from(installedGameNames));
                          
                          // Add each installer to rdDownloads with ready-to-install status
                          const installerEntries = scanResult.installers
                            .filter(installer => {
                              const isInstalled = installedGameNames.has(installer.gameName.toLowerCase());
                              console.log(`[Frontend] Checking ${installer.gameName}: installed=${isInstalled}`);
                              return !isInstalled;
                            })
                            .map((installer, index) => ({
                              id: `extracted-installer-${Date.now()}-${index}`,
                              filename: installer.gameName,
                              gameName: installer.gameName,
                              status: 'ready-to-install',
                              percentage: 100,
                              extractedPath: installer.extractedPath,
                              downloadPaths: []
                            }));
                          
                          if (installerEntries.length > 0) {
                            setRdDownloads(prev => {
                              const existingNames = new Set(prev.map(d => d.gameName));
                              const newEntries = installerEntries.filter(e => !existingNames.has(e.gameName));
                              console.log(`[Frontend] Adding ${newEntries.length} new installer(s) to rdDownloads`);
                              const updated = [...prev, ...newEntries];
                              console.log(`[Frontend] Total rdDownloads: ${updated.length}`);
                              
                              // Force show Download Manager
                              setTimeout(() => {
                                setShowDownloadManager(true);
                                console.log('[Frontend] Download Manager should be visible now');
                              }, 100);
                              
                              return updated;
                            });
                            
                            showToast(`Found ${installerEntries.length} installer(s) ready to install!`, 'success');
                          } else {
                            showToast('All found installers are already installed.', 'info');
                          }
                        } else {
                          showToast('No installers found in download folder.', 'info');
                        }
                      } catch (error) {
                        console.error('[Frontend] Error scanning download folder:', error);
                        showToast('Error scanning download folder: ' + error.message, 'error');
                      }
                    }}
                    style={{ marginTop: '10px' }}
                  >
                    🔍 Scan for Installers
                  </button>
                  <p className="setting-help" style={{ fontSize: '0.85rem', marginTop: '5px' }}>
                    Scans the download folder for extracted game installers that are ready to install
                  </p>
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
                  <button 
                    className="btn-secondary" 
                    onClick={async () => {
                      try {
                        showToast('Scanning install folder for games...', 'info');
                        const result = await window.electronAPI.scanInstallFolder();
                        if (result.success) {
                          if (result.gamesFound > 0) {
                            showToast(`Found and added ${result.gamesFound} new game(s)!`, 'success');
                            // Refresh games list
                            const updatedGames = await window.electronAPI.getGames();
                            setGames(updatedGames);
                            
                            // Refresh images for new games
                            if (apiKey) {
                              updatedGames.forEach(async (game) => {
                                const img = await window.electronAPI.getGameImage(game.id, game.name);
                                if (img) {
                                  setImages(prev => ({ ...prev, [game.id]: img }));
                                }
                              });
                            }
                          } else {
                            showToast('No new games found in install folder.', 'info');
                          }
                        } else {
                          showToast(`Scan failed: ${result.error}`, 'error');
                        }
                      } catch (error) {
                        console.error('Error scanning install folder:', error);
                        showToast('Error scanning install folder: ' + error.message, 'error');
                      }
                    }}
                    style={{ marginTop: '10px' }}
                  >
                    🔍 Scan for Games
                  </button>
                  <p className="setting-help" style={{ fontSize: '0.85rem', marginTop: '5px' }}>
                    Automatically scans subdirectories in the install folder and adds games with executables to your library
                  </p>
                  <button 
                    className="btn-secondary" 
                    onClick={async () => {
                      if (!tempInstallFolder || !tempInstallFolder.trim()) {
                        showToast('Please set an install folder first', 'warning');
                        return;
                      }
                      const folderPath = prompt('Enter the full path to the game folder to diagnose (e.g., C:\\Games\\Inazuma Eleven):', tempInstallFolder + '\\Inazuma Eleven');
                      if (!folderPath) return;
                      
                      try {
                        showToast('Diagnosing folder...', 'info');
                        const result = await window.electronAPI.diagnoseGameFolder(folderPath);
                        if (result.success) {
                          const diag = result.diagnostics;
                          const message = `Folder: ${diag.folderPath}\n` +
                            `Exists: ${diag.exists}\n` +
                            `Is Directory: ${diag.isDirectory}\n` +
                            `Direct Executables: ${diag.executables.length}\n` +
                            `All Executables Found: ${diag.executablesFound.length}\n\n` +
                            `Direct EXEs:\n${diag.executables.map(e => `  - ${e.name}`).join('\n') || '  (none)'}\n\n` +
                            `All Found EXEs:\n${diag.executablesFound.map(e => `  - ${e.relativePath || e.name}`).join('\n') || '  (none)'}`;
                          console.log('[Diagnostic]', diag);
                          alert(message);
                        } else {
                          showToast(`Diagnostic failed: ${result.error}`, 'error');
                        }
                      } catch (error) {
                        console.error('Error diagnosing folder:', error);
                        showToast('Error diagnosing folder: ' + error.message, 'error');
                      }
                    }}
                    style={{ marginTop: '10px', fontSize: '0.9rem' }}
                  >
                    🔬 Diagnose Game Folder
                  </button>
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
                  <button className="btn-secondary" style={{ marginTop: '5px', fontSize: '0.9rem' }} onClick={() => showToast('Review feature coming soon!', 'info')}>
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

      {/* Toast Notifications */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`toast toast-${toast.type}`}
            onClick={() => removeToast(toast.id)}
          >
            <div className="toast-content">
              <span className="toast-message">{toast.message}</span>
              <button className="toast-close" onClick={(e) => { e.stopPropagation(); removeToast(toast.id); }}>×</button>
            </div>
          </div>
        ))}
      </div>

      {/* Confirmation Modal */}
      {confirmationModal && (
        <div className="modal-overlay" onClick={() => handleConfirmation(false)}>
          <div className="modal confirmation-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{confirmationModal.title}</h2>
            </div>
            <div className="modal-body">
              <p style={{ whiteSpace: 'pre-line' }}>{confirmationModal.message}</p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => handleConfirmation(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={() => handleConfirmation(true)}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default App
