import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Custom hook for gamepad/controller support
 * Provides controller navigation and button mapping
 */
export function useGamepad() {
  const [gamepads, setGamepads] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const animationFrameRef = useRef(null);
  const lastButtonStateRef = useRef({});
  const buttonHandlersRef = useRef({});

  // Poll gamepad state
  const pollGamepads = () => {
    const gamepadList = navigator.getGamepads ? navigator.getGamepads() : [];
    const connectedGamepads = Array.from(gamepadList).filter(g => g !== null);

    if (connectedGamepads.length > 0) {
      setGamepads(connectedGamepads);
      setIsConnected(true);

      // Process button presses
      connectedGamepads.forEach((gamepad, index) => {
        if (!gamepad) return;

        gamepad.buttons.forEach((button, buttonIndex) => {
          const buttonKey = `${index}-${buttonIndex}`;
          const wasPressed = lastButtonStateRef.current[buttonKey];
          const isPressed = button.pressed;

          // Detect button press (not hold)
          if (isPressed && !wasPressed) {
            const handler = buttonHandlersRef.current[buttonKey];
            if (handler) {
              handler();
            }
          }

          lastButtonStateRef.current[buttonKey] = isPressed;
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

    return () => {
      window.removeEventListener('gamepadconnected', handleConnect);
      window.removeEventListener('gamepaddisconnected', handleDisconnect);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);


  /**
   * Get current gamepad state
   * @param {number} index - Gamepad index (default: 0)
   * @returns {Gamepad|null} Current gamepad state
   */
  const getGamepad = useCallback((index = 0) => {
    return gamepads[index] || null;
  }, [gamepads]);

  /**
   * Get axis value (for sticks/D-pad) - reads directly from gamepad in real-time
   * @param {number} gamepadIndex - Gamepad index (default: 0)
   * @param {number} axisIndex - Axis index (0 = left stick X, 1 = left stick Y, 2 = right stick X, 3 = right stick Y)
   * @returns {number} Axis value (-1 to 1)
   */
  const getAxis = useCallback((gamepadIndex = 0, axisIndex = 0) => {
    const gamepadList = navigator.getGamepads ? navigator.getGamepads() : [];
    const gamepad = gamepadList[gamepadIndex];
    if (!gamepad || !gamepad.axes) return 0;
    return gamepad.axes[axisIndex] || 0;
  }, []);

  /**
   * Check if button is currently pressed - reads directly from gamepad in real-time
   * @param {number} gamepadIndex - Gamepad index (default: 0)
   * @param {number} buttonIndex - Button index
   * @returns {boolean} True if button is pressed
   */
  const isButtonPressed = useCallback((gamepadIndex = 0, buttonIndex = 0) => {
    const gamepadList = navigator.getGamepads ? navigator.getGamepads() : [];
    const gamepad = gamepadList[gamepadIndex];
    if (!gamepad || !gamepad.buttons) return false;
    return gamepad.buttons[buttonIndex]?.pressed || false;
  }, []);

  /**
   * Register a button handler
   * @param {number} gamepadIndex - Index of the gamepad (default: 0)
   * @param {number} buttonIndex - Index of the button
   * @param {Function} handler - Function to call when button is pressed
   */
  const onButtonPress = useCallback((gamepadIndex, buttonIndex, handler) => {
    const key = `${gamepadIndex}-${buttonIndex}`;
    buttonHandlersRef.current[key] = handler;
  }, []);

  return {
    isConnected,
    gamepads,
    getGamepad,
    getAxis,
    isButtonPressed,
    onButtonPress
  };
}

