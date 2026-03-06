/**
 * Notification sound utility
 * Plays a short notification sound when agent completes a task.
 */

const STORAGE_KEY = 'happyclaw:notification-sound-enabled';
const SOUND_PATH = '/sounds/notification.wav';

let audioInstance: HTMLAudioElement | null = null;
let audioContext: AudioContext | null = null;

/**
 * Check if notification sound is enabled (default: true)
 */
export function isNotificationSoundEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem(STORAGE_KEY);
  // Default to enabled if not set
  return stored !== 'false';
}

/**
 * Set notification sound enabled state
 */
export function setNotificationSoundEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
}

/**
 * Preload the notification sound for faster playback
 */
export function preloadNotificationSound(): void {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return;
  if (audioInstance) return;

  try {
    audioInstance = new Audio(SOUND_PATH);
    audioInstance.preload = 'auto';
    audioInstance.volume = 0.5;
  } catch {
    // Audio not supported
  }
}

/**
 * Play notification sound using Web Audio API fallback for better browser support
 */
function playWithWebAudio(): void {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    // Generate a simple "ding" sound
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5 note
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch {
    // Web Audio API not supported
  }
}

/**
 * Play the notification sound
 * Plays when agent completes a task
 */
export function playNotificationSound(): void {
  if (typeof window === 'undefined') return;

  // Check if enabled
  if (!isNotificationSoundEnabled()) return;

  // Try HTML5 Audio first
  if (audioInstance) {
    audioInstance.currentTime = 0;
    audioInstance.play().catch(() => {
      // Fallback to Web Audio API if HTML5 Audio fails
      playWithWebAudio();
    });
  } else {
    // Fallback to Web Audio API
    playWithWebAudio();
  }
}

/**
 * Initialize sound system - call once on app startup
 */
export function initNotificationSound(): void {
  preloadNotificationSound();
}
