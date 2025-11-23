import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Custom hook for gamepad/controller support
 * Provides controller navigation and button mapping
 */
export function useGamepad() {
  const [gamepads, setGamepads] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [activeGamepadIndex, setActiveGamepadIndex] = useState(0);
  const animationFrameRef = useRef(null);
  const lastButtonStateRef = useRef({});
  const buttonHandlersRef = useRef({});

  // Poll gamepad state
  const pollGamepads = () => {
    const gamepadList = navigator.getGamepads ? navigator.getGamepads() : [];
    const connectedGamepads = Array.from(gamepadList).filter(g => g !== null);

    if (connectedGamepads.length > 0) {
      // Log connected gamepads occasionally (every ~5 seconds) or on change
      if (!lastButtonStateRef.current.lastLogTime || Date.now() - lastButtonStateRef.current.lastLogTime > 5000) {
        console.log('[useGamepad] Connected Gamepads:', connectedGamepads.map((g, i) => ({
          index: g.index,
          id: g.id,
          buttons: g.buttons.length,
          axes: g.axes.length,
          isActive: g.index === activeGamepadIndex
        })));
        lastButtonStateRef.current.lastLogTime = Date.now();
      }

      setGamepads(connectedGamepads);
      setIsConnected(true);

      // Process button presses for ALL gamepads to detect activity
      connectedGamepads.forEach((gamepad) => {
        if (!gamepad) return;

        gamepad.buttons.forEach((button, buttonIndex) => {
          // Check for activity to switch active gamepad
          if (button.pressed) {
            if (gamepad.index !== activeGamepadIndex) {
              console.log(`[useGamepad] Switching active gamepad to index ${gamepad.index} (${gamepad.id})`);
              setActiveGamepadIndex(gamepad.index);
            }
          }

          // Only trigger events for the active gamepad
          if (gamepad.index === activeGamepadIndex) {
            const buttonKey = `${gamepad.index}-${buttonIndex}`;
            const wasPressed = lastButtonStateRef.current[buttonKey];
            const isPressed = button.pressed;

            // Detect button press (not hold)
            if (isPressed && !wasPressed) {
              const handler = buttonHandlersRef.current[`0-${buttonIndex}`]; // We map everything to "0" internally for the app
              if (handler) {
                handler();
              }
            }

            lastButtonStateRef.current[buttonKey] = isPressed;
          }
        });
      });
    } else {
      setIsConnected(false);
      setGamepads([]);
    }

    animationFrameRef.current = requestAnimationFrame(pollGamepads);
  };

  // Handle gamepad connect/disconnect
  useEffect(() => {
    const handleConnect = (e) => {
      console.log('Gamepad connected:', e.gamepad.id);
      setIsConnected(true);
      // If this is the first one, make it active
      if (gamepads.length === 0) {
        setActiveGamepadIndex(e.gamepad.index);
      }
      if (!animationFrameRef.current) {
        pollGamepads();
      }
    };

    const handleDisconnect = (e) => {
      console.log('Gamepad disconnected:', e.gamepad.id);
      const remaining = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(g => g !== null) : [];
      if (remaining.length === 0) {
        setIsConnected(false);
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
      } else {
        // If active gamepad disconnected, switch to another one
        if (e.gamepad.index === activeGamepadIndex) {
          setActiveGamepadIndex(remaining[0].index);
        }
      }
    };

    window.addEventListener('gamepadconnected', handleConnect);
    window.addEventListener('gamepaddisconnected', handleDisconnect);

    // Start polling if gamepads are already connected
    const existingGamepads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(g => g !== null) : [];
    if (existingGamepads.length > 0) {
      setIsConnected(true);
      pollGamepads();
    }

    // Re-check on window focus (fixes issues where controller is lost after Steam game)
    const handleFocus = () => {
      console.log('[useGamepad] Window focused, checking for gamepads...');
      const gamepads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(g => g !== null) : [];
      if (gamepads.length > 0) {
        console.log('[useGamepad] Found gamepads on focus, ensuring polling is active');
        setIsConnected(true);
        if (!animationFrameRef.current) {
          pollGamepads();
        }
      }
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('gamepadconnected', handleConnect);
      window.removeEventListener('gamepaddisconnected', handleDisconnect);
      window.removeEventListener('focus', handleFocus);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);


  /**
   * Get current gamepad state
   * @param {number} index - Gamepad index (default: active)
   * @returns {Gamepad|null} Current gamepad state
   */
  const getGamepad = useCallback((index = activeGamepadIndex) => {
    return gamepads.find(g => g.index === index) || null;
  }, [gamepads, activeGamepadIndex]);

  /**
   * Get axis value (for sticks/D-pad) - reads directly from gamepad in real-time
   * @param {number} gamepadIndex - Gamepad index (default: active)
   * @param {number} axisIndex - Axis index (0 = left stick X, 1 = left stick Y, 2 = right stick X, 3 = right stick Y)
   * @returns {number} Axis value (-1 to 1)
   */
  const getAxis = useCallback((gamepadIndex = activeGamepadIndex, axisIndex = 0) => {
    const gamepadList = navigator.getGamepads ? navigator.getGamepads() : [];
    const gamepad = gamepadList[gamepadIndex];
    if (!gamepad || !gamepad.axes) return 0;
    return gamepad.axes[axisIndex] || 0;
  }, [activeGamepadIndex]);

  /**
   * Check if button is currently pressed - reads directly from gamepad in real-time
   * @param {number} gamepadIndex - Gamepad index (default: active)
   * @param {number} buttonIndex - Button index
   * @returns {boolean} True if button is pressed
   */
  const isButtonPressed = useCallback((gamepadIndex = activeGamepadIndex, buttonIndex = 0) => {
    const gamepadList = navigator.getGamepads ? navigator.getGamepads() : [];
    const gamepad = gamepadList[gamepadIndex];
    if (!gamepad || !gamepad.buttons) return false;
    return gamepad.buttons[buttonIndex]?.pressed || false;
  }, [activeGamepadIndex]);

  /**
   * Register a button handler
   * @param {number} gamepadIndex - Index of the gamepad (default: 0 - ignored for registration, we map to 0)
   * @param {number} buttonIndex - Index of the button
   * @param {Function} handler - Function to call when button is pressed
   */
  const onButtonPress = useCallback((gamepadIndex, buttonIndex, handler) => {
    // We register handlers with a generic index "0" so they trigger for whichever gamepad is active
    const key = `0-${buttonIndex}`;
    buttonHandlersRef.current[key] = handler;
  }, []);

  return {
    isConnected,
    gamepads,
    activeGamepadIndex,
    getGamepad,
    getAxis,
    isButtonPressed,
    onButtonPress
  };
}

