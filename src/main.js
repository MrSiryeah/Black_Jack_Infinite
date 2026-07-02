import './style.css';
import { Deck, Hand, getBasicStrategyAdvice } from './blackjack.js';
import { sounds } from './sounds.js';
import { recreatePlayerHandSlots, renderHand, formatCurrency, showStatusMessage, hideStatusMessage } from './ui.js';
import { 
  initSupabase, 
  getSupabase, 
  isConnected, 
  signUp, 
  signIn, 
  signOut, 
  getProfile, 
  updateProfile, 
  getStats, 
  updateStats, 
  getLeaderboard,
  createFallbackProfile
} from './supabase.js';

// --- GAME STATE ---
let bankroll = 1000;
let currentBet = 0;
let lastBet = 0;
let activeHandIndex = 0;
let gameState = 'betting'; // 'betting', 'dealing', 'player-turn', 'dealer-turn', 'payout', 'insurance-prompt'
let insuranceBet = 0;

let deck = null;
let playerHands = [];
let dealerHand = null;

// Auth / Profile States
let currentUser = null; // Supabase user object
let userProfile = null;  // Supabase profiles table row
let pendingAuthProfile = null; // Stash online profile during sync confirm
let pendingAuthStats = null;   // Stash online stats during sync confirm
let isExplicitLogin = false;   // Distinguish page load from user action


// Guest Backup (for sync operations)
let guestBankroll = 1000;
let guestStats = null;

// Default Settings
let settings = {
  sound: true,
  strategy: true,
  counting: false,
  numDecks: 6,
  dealerSoft17: 'stand',
  tableTheme: 'green'
};

// Default Session/Guest Stats
let stats = {
  handsPlayed: 0,
  handsWon: 0,
  handsLost: 0,
  handsTied: 0,
  blackjacks: 0,
  highestBalance: 1000,
  netProfit: 0
};

// --- DOM ELEMENTS ---
const elApp = document.getElementById('app');
const elTable = document.getElementById('blackjack-table');
const elDisplayBankroll = document.getElementById('display-bankroll');
const elDisplayTotalBet = document.getElementById('display-total-bet');
const elDealerCards = document.getElementById('dealer-cards');
const elDealerScore = document.getElementById('dealer-score');
const elPlayerHandsContainer = document.getElementById('player-hands-container');
const elGameStatusMsg = document.getElementById('game-status-msg');
const elStrategyCoach = document.getElementById('strategy-coach');
const elStrategyAdvice = document.getElementById('strategy-advice');
const elCountingBoard = document.getElementById('counting-stats-board');
const elValRunningCount = document.getElementById('val-running-count');
const elValTrueCount = document.getElementById('val-true-count');
const elValPenetration = document.getElementById('val-penetration');

// Sound Buttons
const elBtnSoundToggle = document.getElementById('btn-sound-toggle');
const elSoundIconOn = document.getElementById('sound-icon-on');
const elSoundIconOff = document.getElementById('sound-icon-off');

// Betting Panel Elements
const elBettingControls = document.getElementById('betting-controls');
const elBtnClear = document.getElementById('btn-clear');
const elBtnDoubleBet = document.getElementById('btn-double-bet');
const elBtnDeal = document.getElementById('btn-deal');
const elChipBtns = document.querySelectorAll('.chip-btn');

// Game Action Panel Elements
const elGameControls = document.getElementById('game-controls');
const elBtnHit = document.getElementById('btn-hit');
const elBtnStand = document.getElementById('btn-stand');
const elBtnDouble = document.getElementById('btn-double');
const elBtnSplit = document.getElementById('btn-split');

// Insurance Panel Elements
const elInsuranceControls = document.getElementById('insurance-controls');
const elBtnInsuranceYes = document.getElementById('btn-insurance-yes');
const elBtnInsuranceNo = document.getElementById('btn-insurance-no');

// Modals
const elModalSettings = document.getElementById('modal-settings');
const elModalStats = document.getElementById('modal-stats');
const elModalRules = document.getElementById('modal-rules');
const elModalLeaderboard = document.getElementById('modal-leaderboard');
const elModalAuth = document.getElementById('modal-auth');
const elModalSyncConfirm = document.getElementById('modal-sync-confirm');

// Modal Triggers
const elBtnSettings = document.getElementById('btn-settings');
const elBtnStats = document.getElementById('btn-stats');
const elBtnRules = document.getElementById('btn-rules');
const elBtnLeaderboard = document.getElementById('btn-leaderboard');
const elBtnAuthTrigger = document.getElementById('btn-auth-trigger');
const elBtnSignout = document.getElementById('btn-signout');

// Modal Close elements
const elModalCloseBtns = document.querySelectorAll('.modal-close, .modal-close-btn');

// Settings Fields
const elSetSound = document.getElementById('set-sound');
const elSetStrategy = document.getElementById('set-strategy');
const elSetCounting = document.getElementById('set-counting');
const elSetDecks = document.getElementById('set-decks');
const elSetDealerRules = document.getElementById('set-dealer-rules');
const elThemeSelects = document.querySelectorAll('.theme-select');
const elBtnResetBankroll = document.getElementById('btn-reset-bankroll');

// Supabase Settings Config
const elSetDbUrl = document.getElementById('set-db-url');
const elSetDbKey = document.getElementById('set-db-key');
const elBtnConnectDb = document.getElementById('btn-connect-db');
const elDbStatusLabel = document.getElementById('db-status-label');

// Auth Form Elements
const elAuthTitle = document.getElementById('auth-title');
const elTabSignin = document.getElementById('tab-signin');
const elTabSignup = document.getElementById('tab-signup');
const elFormSignin = document.getElementById('form-signin');
const elFormSignup = document.getElementById('form-signup');
const elAuthError = document.getElementById('auth-error-msg');

const elSigninEmail = document.getElementById('signin-email');
const elSigninPassword = document.getElementById('signin-password');
const elSignupUsername = document.getElementById('signup-username');
const elSignupEmail = document.getElementById('signup-email');
const elSignupPassword = document.getElementById('signup-password');

// Sync Confirmation Elements
const elBtnSyncFresh = document.getElementById('btn-sync-fresh');
const elBtnSyncMerge = document.getElementById('btn-sync-merge');

// Leaderboard Modal Elements
const elLeaderboardLoading = document.getElementById('leaderboard-loading');
const elLeaderboardEmpty = document.getElementById('leaderboard-empty');
const elLeaderboardTableContainer = document.getElementById('leaderboard-table-container');
const elLeaderboardRows = document.getElementById('leaderboard-rows');

// User Profile Badge in Header
const elUserProfileBadge = document.getElementById('user-profile-badge');
const elUserBadgeName = document.getElementById('user-badge-name');
const elUserBadgeLevel = document.getElementById('user-badge-level');
const elUserBadgeXpProgress = document.getElementById('user-badge-xp-progress');

// --- INITIALIZATION ---
function init() {
  loadLocalData();
  applySettings();
  applyStats();
  
  deck = new Deck(settings.numDecks);
  
  setupEventListeners();

  // Try to connect to Supabase if config exists in LocalStorage
  const savedUrl = localStorage.getItem('bj_supabase_url') || import.meta.env.VITE_SUPABASE_URL;
  const savedKey = localStorage.getItem('bj_supabase_anon_key') || import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  if (savedUrl && savedKey) {
    elSetDbUrl.value = savedUrl;
    elSetDbKey.value = savedKey;
    connectToSupabase(savedUrl, savedKey, false);
  }

  updateUI();
}

// --- LOCAL DATA PERSISTENCE (GUEST) ---
function loadLocalData() {
  try {
    const savedBankroll = localStorage.getItem('bj_bankroll');
    if (savedBankroll !== null) bankroll = parseInt(savedBankroll, 10);
    
    const savedSettings = localStorage.getItem('bj_settings');
    if (savedSettings !== null) settings = { ...settings, ...JSON.parse(savedSettings) };
    
    const savedStats = localStorage.getItem('bj_stats');
    if (savedStats !== null) stats = { ...stats, ...JSON.parse(savedStats) };

    const savedLastBet = localStorage.getItem('bj_last_bet');
    if (savedLastBet !== null) lastBet = parseInt(savedLastBet, 10);

    // Sync reference of guest stats for merging
    guestBankroll = bankroll;
    guestStats = { ...stats };
  } catch (e) {
    console.error("Error loading guest localStorage data:", e);
  }
}

// Global Save coordinator
async function saveGameState() {
  try {
    localStorage.setItem('bj_last_bet', lastBet.toString());
    localStorage.setItem('bj_settings', JSON.stringify(settings));

    if (currentUser && isConnected()) {
      // ONLINE SAVE TO CLOUD
      if (userProfile) {
        userProfile.balance = bankroll;
        // update profile table
        await updateProfile(currentUser.id, {
          balance: bankroll,
          xp: userProfile.xp,
          level: userProfile.level
        });
        
        // update stats table
        await updateStats(currentUser.id, {
          hands_played: stats.handsPlayed,
          hands_won: stats.handsWon,
          hands_lost: stats.handsLost,
          hands_tied: stats.handsTied,
          blackjacks: stats.blackjacks,
          highest_balance: stats.highestBalance
        });
      }
    } else {
      // OFFLINE SAVE TO LOCAL STORAGE
      localStorage.setItem('bj_bankroll', bankroll.toString());
      localStorage.setItem('bj_stats', JSON.stringify(stats));
      guestBankroll = bankroll;
      guestStats = { ...stats };
    }
  } catch (e) {
    console.error("Error saving game state:", e);
  }
}

// Apply settings state to UI controls
function applySettings() {
  sounds.toggle(settings.sound);
  elSetSound.checked = settings.sound;
  if (settings.sound) {
    elSoundIconOn.classList.remove('hidden');
    elSoundIconOff.classList.add('hidden');
  } else {
    elSoundIconOn.classList.add('hidden');
    elSoundIconOff.classList.remove('hidden');
  }

  elSetStrategy.checked = settings.strategy;
  if (settings.strategy) {
    elStrategyCoach.classList.remove('hidden');
  } else {
    elStrategyCoach.classList.add('hidden');
  }

  elSetCounting.checked = settings.counting;
  if (settings.counting) {
    elCountingBoard.classList.remove('hidden');
  } else {
    elCountingBoard.classList.add('hidden');
  }

  elSetDecks.value = settings.numDecks;
  elSetDealerRules.value = settings.dealerSoft17;

  // Apply Theme
  elApp.className = `theme-${settings.tableTheme}`;
  elThemeSelects.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === settings.tableTheme);
  });
}

// Render statistics in modal
function applyStats() {
  document.getElementById('stat-hands-played').textContent = stats.handsPlayed;
  document.getElementById('stat-hands-won').textContent = stats.handsWon;
  document.getElementById('stat-hands-lost').textContent = stats.handsLost;
  document.getElementById('stat-hands-tied').textContent = stats.handsTied;
  document.getElementById('stat-blackjacks').textContent = stats.blackjacks;
  document.getElementById('stat-highest-bal').textContent = formatCurrency(stats.highestBalance);
  
  const netProfitEl = document.getElementById('stat-net-profit');
  const netVal = stats.netProfit;
  netProfitEl.textContent = (netVal >= 0 ? '+' : '') + formatCurrency(netVal);
  netProfitEl.className = 'stat-num ' + (netVal > 0 ? 'positive' : (netVal < 0 ? 'negative' : 'neutral'));

  const winRate = stats.handsPlayed > 0 ? Math.round((stats.handsWon / stats.handsPlayed) * 100) : 0;
  document.getElementById('stat-win-rate').textContent = `${winRate}%`;
}

// --- SUPABASE ENGINE ORCHESTRATION ---
async function connectToSupabase(url, key, saveToStorage = false) {
  elDbStatusLabel.textContent = "Connecting...";
  elDbStatusLabel.className = "db-status disconnected";

  const success = initSupabase(url, key);
  
  if (success) {
    elDbStatusLabel.textContent = "Connected";
    elDbStatusLabel.className = "db-status connected";
    
    if (saveToStorage) {
      localStorage.setItem('bj_supabase_url', url);
      localStorage.setItem('bj_supabase_anon_key', key);
    }

    // Set up auth state listener
    const sb = getSupabase();
    sb.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        currentUser = session.user;
        await handleUserLogin(session.user, isExplicitLogin);
        isExplicitLogin = false; // Reset after handling
      } else {
        currentUser = null;
        handleUserLogout();
      }
    });

    // Check if user is already logged in right now (session recovery)
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
      currentUser = session.user;
      await handleUserLogin(session.user, false); // Implicit login (no guest sync modal)
    }
  } else {
    elDbStatusLabel.textContent = "Failed";
    elDbStatusLabel.className = "db-status disconnected";
    currentUser = null;
    userProfile = null;
    updateUI();
  }
}

async function handleUserLogin(user, isExplicit = false) {
  // Fetch cloud profile and statistics
  let profile = await getProfile(user.id);
  let cloudStats = await getStats(user.id);

  // Fallback if profiles table is missing the row (trigger failure safety net)
  if (!profile || !cloudStats) {
    const metaUsername = user.user_metadata?.username || user.raw_user_meta_data?.username;
    profile = await createFallbackProfile(user.id, user.email, metaUsername);
    cloudStats = await getStats(user.id);
  }

  if (!profile || !cloudStats) {
    console.error("Critical: Profile/stats could not be recovered or created.");
    return;
  }

  // Check if we have guest progress to merge
  const isGuestActive = (guestStats && guestStats.handsPlayed > 0) || guestBankroll !== 1000;
  
  if (isExplicit && isGuestActive) {
    // Show sync confirmation modal stashing profiles
    pendingAuthProfile = profile;
    pendingAuthStats = cloudStats;
    showModal(elModalSyncConfirm);
  } else {
    // Start directly with online profile
    applyUserProfile(profile, cloudStats);
  }
}

function applyUserProfile(profile, cloudStats) {
  userProfile = profile;
  bankroll = profile.balance;

  // Map cloud stats
  stats = {
    handsPlayed: cloudStats.hands_played,
    handsWon: cloudStats.hands_won,
    handsLost: cloudStats.hands_lost,
    handsTied: cloudStats.hands_tied,
    blackjacks: cloudStats.blackjacks,
    highestBalance: cloudStats.highest_balance,
    netProfit: bankroll - 1000
  };

  // Sync profile UI badge
  updateProfileBadge();
  applyStats();
  updateUI();
}

function handleUserLogout() {
  userProfile = null;
  currentUser = null;
  
  // Revert back to guest state
  loadLocalData();
  
  updateProfileBadge();
  applyStats();
  updateUI();
}

// Update XP & level, handling Level Up animations
async function rewardXP(amount) {
  if (!userProfile) return;

  userProfile.xp += amount;
  
  // Formula: L = Math.floor(Math.sqrt(xp / 100)) + 1
  const newLevel = Math.floor(Math.sqrt(userProfile.xp / 100)) + 1;
  
  if (newLevel > userProfile.level) {
    userProfile.level = newLevel;
    
    // Level Up presentation
    sounds.playWin();
    showStatusMessage(elGameStatusMsg, `LEVEL UP! REACHED LEVEL ${newLevel} 🎉`);
    
    // Level-up border glow effect
    elUserProfileBadge.style.boxShadow = '0 0 20px rgba(212, 175, 55, 0.8)';
    elUserProfileBadge.style.borderColor = 'var(--gold)';
    
    setTimeout(() => {
      hideStatusMessage(elGameStatusMsg);
      elUserProfileBadge.style.boxShadow = '';
      elUserProfileBadge.style.borderColor = '';
    }, 2500);
  }

  updateProfileBadge();
}

function updateProfileBadge() {
  if (userProfile && currentUser) {
    elUserProfileBadge.classList.remove('hidden');
    elBtnAuthTrigger.classList.add('hidden');
    elBtnSignout.classList.remove('hidden');

    elUserBadgeName.textContent = userProfile.username;
    elUserBadgeLevel.textContent = `Lv.${userProfile.level}`;
    
    // Progress calculation
    // Min XP for current level = (L-1)^2 * 100
    // Max XP for current level = L^2 * 100
    const L = userProfile.level;
    const minXp = (L - 1) * (L - 1) * 100;
    const maxXp = L * L * 100;
    const range = maxXp - minXp;
    const currentProgress = userProfile.xp - minXp;
    const percent = Math.min(100, Math.max(0, Math.round((currentProgress / range) * 100)));
    
    elUserBadgeXpProgress.style.width = `${percent}%`;
    elUserProfileBadge.title = `Username: ${userProfile.username}\nLevel: ${userProfile.level}\nXP: ${userProfile.xp} / ${maxXp}`;
  } else {
    elUserProfileBadge.classList.add('hidden');
    elBtnAuthTrigger.classList.remove('hidden');
    elBtnSignout.classList.add('hidden');
  }
}

// --- MODALS AND EVENTS BINDINGS ---
function setupEventListeners() {
  // Quick sound toggle
  elBtnSoundToggle.addEventListener('click', () => {
    settings.sound = sounds.toggle();
    applySettings();
    saveGameState();
    if (settings.sound) sounds.playChipClick();
  });

  // Modal open triggers
  elBtnSettings.addEventListener('click', () => showModal(elModalSettings));
  elBtnStats.addEventListener('click', () => { applyStats(); showModal(elModalStats); });
  elBtnRules.addEventListener('click', () => showModal(elModalRules));
  elBtnLeaderboard.addEventListener('click', () => { renderLeaderboardUI(); showModal(elModalLeaderboard); });
  elBtnAuthTrigger.addEventListener('click', () => {
    elAuthError.classList.add('hidden');
    showModal(elModalAuth);
  });
  
  elBtnSignout.addEventListener('click', async () => {
    if (confirm("Are you sure you want to log out?")) {
      await signOut();
    }
  });

  // Modal close triggers
  elModalCloseBtns.forEach(btn => {
    btn.addEventListener('click', closeAllModals);
  });

  // Close modals on clicking overlay background
  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      closeAllModals();
    }
  });

  // Settings modification
  elSetSound.addEventListener('change', (e) => {
    settings.sound = e.target.checked;
    applySettings();
    saveGameState();
  });

  elSetStrategy.addEventListener('change', (e) => {
    settings.strategy = e.target.checked;
    applySettings();
    saveGameState();
  });

  elSetCounting.addEventListener('change', (e) => {
    settings.counting = e.target.checked;
    applySettings();
    saveGameState();
  });

  elSetDecks.addEventListener('change', (e) => {
    const val = parseInt(e.target.value, 10);
    settings.numDecks = val;
    deck = new Deck(val);
    saveGameState();
    sounds.playShuffle();
  });

  elSetDealerRules.addEventListener('change', (e) => {
    settings.dealerSoft17 = e.target.value;
    saveGameState();
  });

  // Theme selector
  elThemeSelects.forEach(btn => {
    btn.addEventListener('click', () => {
      settings.tableTheme = btn.dataset.theme;
      applySettings();
      saveGameState();
      if (settings.sound) sounds.playChipClick();
    });
  });

  // Reset Bankroll (Guest Mode)
  elBtnResetBankroll.addEventListener('click', async () => {
    const isOnline = (currentUser && userProfile);
    const msg = isOnline 
      ? "Are you sure you want to reset your online bankroll to $1,000? Your XP and stats will be preserved."
      : "Are you sure you want to reset your local bankroll and all session statistics?";

    if (confirm(msg)) {
      bankroll = 1000;
      if (!isOnline) {
        stats = {
          handsPlayed: 0,
          handsWon: 0,
          handsLost: 0,
          handsTied: 0,
          blackjacks: 0,
          highestBalance: 1000,
          netProfit: 0
        };
      }
      currentBet = 0;
      lastBet = 0;
      await saveGameState();
      applyStats();
      updateUI();
      closeAllModals();
      if (settings.sound) sounds.playShuffle();
    }
  });

  // Connect Database configuration button
  elBtnConnectDb.addEventListener('click', () => {
    const url = elSetDbUrl.value.trim();
    const key = elSetDbKey.value.trim();
    if (!url || !key) {
      alert("Please fill in both the Supabase URL and Anon Key.");
      return;
    }
    connectToSupabase(url, key, true);
  });

  // Auth Tab Toggles
  elTabSignin.addEventListener('click', () => {
    elTabSignin.classList.add('active');
    elTabSignup.classList.remove('active');
    elFormSignin.classList.remove('hidden');
    elFormSignup.classList.add('hidden');
    elAuthTitle.textContent = "Account Access";
    elAuthError.classList.add('hidden');
  });

  elTabSignup.addEventListener('click', () => {
    elTabSignin.classList.remove('active');
    elTabSignup.classList.add('active');
    elFormSignin.classList.add('hidden');
    elFormSignup.classList.remove('hidden');
    elAuthTitle.textContent = "Create Account";
    elAuthError.classList.add('hidden');
  });

  // Sign In submit
  elFormSignin.addEventListener('submit', async (e) => {
    e.preventDefault();
    elAuthError.classList.add('hidden');
    const email = elSigninEmail.value.trim();
    const password = elSigninPassword.value;

    try {
      isExplicitLogin = true; // Mark as explicit user sign-in action
      await signIn(email, password);
      elModalAuth.classList.add('hidden');
      // Clear fields
      elSigninEmail.value = '';
      elSigninPassword.value = '';
    } catch (err) {
      isExplicitLogin = false; // Reset on failure
      elAuthError.textContent = err.message || "Failed to sign in.";
      elAuthError.classList.remove('hidden');
    }
  });

  // Sign Up submit
  elFormSignup.addEventListener('submit', async (e) => {
    e.preventDefault();
    elAuthError.classList.add('hidden');
    const username = elSignupUsername.value.trim();
    const email = elSignupEmail.value.trim();
    const password = elSignupPassword.value;

    try {
      await signUp(email, password, username);
      alert("Registration successful! Check your email for confirmation (if enabled) or sign in now.");
      
      // Auto-toggle to Sign In tab
      elTabSignin.click();
      elSigninEmail.value = email;
      elSignupUsername.value = '';
      elSignupEmail.value = '';
      elSignupPassword.value = '';
    } catch (err) {
      elAuthError.textContent = err.message || "Failed to register account.";
      elAuthError.classList.remove('hidden');
    }
  });

  // Sync Choices Events
  elBtnSyncFresh.addEventListener('click', () => {
    // Start fresh: discard local progress
    localStorage.removeItem('bj_bankroll');
    localStorage.removeItem('bj_stats');
    guestBankroll = 1000;
    guestStats = null;
    
    applyUserProfile(pendingAuthProfile, pendingAuthStats);
    closeAllModals();
  });

  elBtnSyncMerge.addEventListener('click', async () => {
    // Merge: Combine guest stats and add balance
    const onlineProfile = pendingAuthProfile;
    const onlineStats = pendingAuthStats;

    // Add guest balance to cloud balance
    const newBalance = onlineProfile.balance + (guestBankroll - 1000);
    onlineProfile.balance = Math.max(0, newBalance);

    // Sum statistics
    const newStats = {
      hands_played: onlineStats.hands_played + (guestStats ? guestStats.handsPlayed : 0),
      hands_won: onlineStats.hands_won + (guestStats ? guestStats.handsWon : 0),
      hands_lost: onlineStats.hands_lost + (guestStats ? guestStats.handsLost : 0),
      hands_tied: onlineStats.hands_tied + (guestStats ? guestStats.handsTied : 0),
      blackjacks: onlineStats.blackjacks + (guestStats ? guestStats.blackjacks : 0),
      highest_balance: Math.max(onlineStats.highest_balance, guestStats ? guestStats.highestBalance : 0)
    };

    try {
      // Write merge to Supabase
      await updateProfile(onlineProfile.id, {
        balance: onlineProfile.balance
      });
      await updateStats(onlineProfile.id, newStats);

      // Clear guest local progress
      localStorage.removeItem('bj_bankroll');
      localStorage.removeItem('bj_stats');
      guestBankroll = 1000;
      guestStats = null;

      applyUserProfile(onlineProfile, newStats);
      sounds.playShuffle();
    } catch (e) {
      alert("Error synchronizing data: " + e.message);
    }
    
    closeAllModals();
  });

  // Betting Actions
  elChipBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const amt = parseInt(btn.dataset.amount, 10);
      addBet(amt);
    });
  });

  elBtnClear.addEventListener('click', () => {
    if (currentBet > 0) {
      currentBet = 0;
      sounds.playChipCollect();
      updateUI();
    }
  });

  elBtnDoubleBet.addEventListener('click', () => {
    if (currentBet > 0) {
      if (currentBet * 2 <= bankroll) {
        currentBet *= 2;
        sounds.playChipClick();
      } else {
        currentBet = bankroll;
        sounds.playChipClick();
      }
    } else {
      if (lastBet > 0 && lastBet <= bankroll) {
        currentBet = lastBet;
        sounds.playChipClick();
      }
    }
    updateUI();
  });

  elBtnDeal.addEventListener('click', () => {
    startHand();
  });

  // Gameplay Actions
  elBtnHit.addEventListener('click', () => {
    playerHit();
  });

  elBtnStand.addEventListener('click', () => {
    playerStand();
  });

  elBtnDouble.addEventListener('click', () => {
    playerDouble();
  });

  elBtnSplit.addEventListener('click', () => {
    playerSplit();
  });

  // Insurance Actions
  elBtnInsuranceYes.addEventListener('click', () => {
    buyInsurance(true);
  });
  elBtnInsuranceNo.addEventListener('click', () => {
    buyInsurance(false);
  });
}

function showModal(modal) {
  modal.classList.remove('hidden');
}

function closeAllModals() {
  elModalSettings.classList.add('hidden');
  elModalStats.classList.add('hidden');
  elModalRules.classList.add('hidden');
  elModalLeaderboard.classList.add('hidden');
  elModalAuth.classList.add('hidden');
  elModalSyncConfirm.classList.add('hidden');
}

// --- LEADERBOARD RENDERER ---
async function renderLeaderboardUI() {
  elLeaderboardLoading.classList.remove('hidden');
  elLeaderboardEmpty.classList.add('hidden');
  elLeaderboardTableContainer.classList.add('hidden');
  elLeaderboardRows.innerHTML = '';

  if (!isConnected()) {
    elLeaderboardLoading.classList.add('hidden');
    elLeaderboardEmpty.textContent = "Leaderboard requires Supabase. Open settings to connect.";
    elLeaderboardEmpty.classList.remove('hidden');
    return;
  }

  try {
    const list = await getLeaderboard();
    elLeaderboardLoading.classList.add('hidden');

    if (list.length === 0) {
      elLeaderboardEmpty.textContent = "No entries found yet. Start playing to rank!";
      elLeaderboardEmpty.classList.remove('hidden');
      return;
    }

    list.forEach((item, index) => {
      const row = document.createElement('tr');
      
      // Highlight current logged-in user in rows
      if (userProfile && item.username === userProfile.username) {
        row.className = 'current-user';
      }

      row.innerHTML = `
        <td>${index + 1}</td>
        <td>${item.username}</td>
        <td>Lv.${item.level || 1}</td>
        <td class="txt-right font-bold">${formatCurrency(item.balance)}</td>
      `;
      elLeaderboardRows.appendChild(row);
    });

    elLeaderboardTableContainer.classList.remove('hidden');
  } catch (e) {
    elLeaderboardLoading.classList.add('hidden');
    elLeaderboardEmpty.textContent = "Failed to load leaderboard data.";
    elLeaderboardEmpty.classList.remove('hidden');
  }
}

// --- BETTING CONTROLS ---
function addBet(amount) {
  if (gameState !== 'betting') return;
  
  if (currentBet + amount <= bankroll) {
    currentBet += amount;
    sounds.playChipClick();
    updateUI();
  } else {
    flashBankrollRed();
  }
}

function flashBankrollRed() {
  const container = document.querySelector('.bankroll-metric');
  container.style.color = '#ff4d4d';
  container.style.transform = 'scale(1.05)';
  setTimeout(() => {
    container.style.color = '';
    container.style.transform = '';
  }, 300);
}

// --- GAME FLOW ORCHESTRATION ---

async function startHand() {
  if (gameState !== 'betting') return;
  if (currentBet <= 0) return;
  if (currentBet > bankroll) {
    currentBet = bankroll;
  }

  // Set state
  gameState = 'dealing';
  bankroll -= currentBet;
  lastBet = currentBet;
  await saveGameState();

  hideStatusMessage(elGameStatusMsg);
  
  // Clear Hands
  playerHands = [new Hand(false)];
  playerHands[0].bet = currentBet;
  playerHands[0].isActive = true;
  activeHandIndex = 0;

  dealerHand = new Hand(true);

  // Update UI console
  updateUI();

  // If shoe penetration is high (>75%), shuffle the deck
  if (deck.penetrationPercent > 75) {
    showStatusMessage(elGameStatusMsg, "Shuffling Shoe...");
    sounds.playShuffle();
    await sleep(1500);
    deck.reset();
    hideStatusMessage(elGameStatusMsg);
  }

  // Deal initial cards
  playerHands[0].addCard(deck.draw());
  sounds.playCardDeal();
  renderGameBoards();
  await sleep(400);

  dealerHand.addCard(deck.draw());
  sounds.playCardDeal();
  renderGameBoards();
  await sleep(400);

  playerHands[0].addCard(deck.draw());
  sounds.playCardDeal();
  renderGameBoards();
  await sleep(400);

  dealerHand.addCard(deck.draw());
  sounds.playCardDeal();
  renderDealerHandUI(true); // hide dealer hole card
  updateStrategyAdvice();
  updateCardCounting();
  await sleep(450);

  // Check Dealer Ace for Insurance Prompt
  const dealerUpCard = dealerHand.cards[0];
  if (dealerUpCard.rank === 'A' && bankroll >= Math.floor(currentBet / 2) && !playerHands[0].isBlackjack()) {
    gameState = 'insurance-prompt';
    updateUI();
    return;
  }

  checkInitialBlackjacks();
}

function buyInsurance(buy) {
  if (gameState !== 'insurance-prompt') return;

  if (buy) {
    insuranceBet = Math.floor(currentBet / 2);
    bankroll -= insuranceBet;
    sounds.playChipClick();
    saveGameState();
    showStatusMessage(elGameStatusMsg, `Insurance placed: $${insuranceBet}`);
  } else {
    insuranceBet = 0;
  }

  setTimeout(() => {
    hideStatusMessage(elGameStatusMsg);
    checkInitialBlackjacks();
  }, 1000);
}

function checkInitialBlackjacks() {
  const playerBJ = playerHands[0].isBlackjack();
  const dealerBJ = dealerHand.isBlackjack();

  if (playerBJ || dealerBJ) {
    endHandInstantBlackjacks(playerBJ, dealerBJ);
  } else {
    gameState = 'player-turn';
    updateUI();
  }
}

async function endHandInstantBlackjacks(playerBJ, dealerBJ) {
  gameState = 'dealer-turn';
  
  // Reveal Dealer Cards
  renderDealerHandUI(false);
  sounds.playCardDeal();
  await sleep(600);

  gameState = 'payout';

  let results = [];
  if (playerBJ && dealerBJ) {
    results = ['push'];
    bankroll += currentBet;
    showStatusMessage(elGameStatusMsg, "Blackjack Push!");
    sounds.playPush();
  } else if (playerBJ) {
    results = ['blackjack'];
    const payout = Math.floor(currentBet * 2.5);
    bankroll += payout;
    showStatusMessage(elGameStatusMsg, "Blackjack! Pays 3 to 2");
    sounds.playWin();
    stats.blackjacks++;
    // Reward XP (+10 played, +20 win, +50 blackjack = 80 XP total)
    await rewardXP(80);
  } else if (dealerBJ) {
    results = ['lose'];
    showStatusMessage(elGameStatusMsg, "Dealer has Blackjack!");
    sounds.playLose();
    // Reward XP (+10 played)
    await rewardXP(10);
  }

  // Insurance resolution
  if (dealerBJ && insuranceBet > 0) {
    bankroll += insuranceBet * 3;
  }

  insuranceBet = 0;

  // Record Stats
  stats.handsPlayed++;
  if (playerBJ && !dealerBJ) stats.handsWon++;
  else if (dealerBJ && !playerBJ) stats.handsLost++;
  else stats.handsTied++;

  resolveSessionStats();
  
  recreatePlayerHandSlots(elPlayerHandsContainer, playerHands, activeHandIndex, results);
  
  gameState = 'betting';
  currentBet = 0;
  await saveGameState();
  updateUI();
}

// --- PLAYER TURN ACTIONS ---

async function playerHit() {
  if (gameState !== 'player-turn') return;

  const currentHand = playerHands[activeHandIndex];
  currentHand.addCard(deck.draw());
  sounds.playCardDeal();
  
  renderGameBoards();
  updateCardCounting();
  updateStrategyAdvice();

  if (currentHand.isBusted()) {
    sounds.playLose();
    await sleep(600);
    advanceHand();
  } else if (currentHand.getScore() === 21) {
    await sleep(400);
    playerStand();
  }
}

async function playerStand() {
  if (gameState !== 'player-turn') return;

  const currentHand = playerHands[activeHandIndex];
  currentHand.status = 'stood';
  
  advanceHand();
}

async function playerDouble() {
  if (gameState !== 'player-turn') return;

  const currentHand = playerHands[activeHandIndex];
  if (bankroll < currentHand.bet) return;

  bankroll -= currentHand.bet;
  currentHand.bet *= 2;
  await saveGameState();

  currentHand.addCard(deck.draw());
  sounds.playCardDeal();
  
  renderGameBoards();
  updateCardCounting();
  updateStrategyAdvice();
  updateUI();

  if (currentHand.isBusted()) {
    sounds.playLose();
  }

  await sleep(800);
  advanceHand();
}

async function playerSplit() {
  if (gameState !== 'player-turn') return;

  const currentHand = playerHands[activeHandIndex];
  
  if (!currentHand.isPair() || playerHands.length >= 4 || bankroll < currentHand.bet) {
    return;
  }

  bankroll -= currentHand.bet;
  await saveGameState();

  const newHand = new Hand(false);
  newHand.bet = currentHand.bet;
  
  const splitCard = currentHand.cards.pop();
  newHand.addCard(splitCard);

  currentHand.addCard(deck.draw());
  sounds.playCardDeal();

  playerHands.splice(activeHandIndex + 1, 0, newHand);

  renderGameBoards();
  await sleep(400);

  newHand.addCard(deck.draw());
  sounds.playCardDeal();

  if (splitCard.rank === 'A') {
    renderGameBoards();
    updateCardCounting();
    await sleep(600);
    playerHands.forEach(h => h.status = 'stood');
    activeHandIndex = playerHands.length; 
    playDealerTurn();
    return;
  }

  renderGameBoards();
  updateCardCounting();
  updateStrategyAdvice();
  updateUI();
}

function advanceHand() {
  playerHands[activeHandIndex].isActive = false;
  activeHandIndex++;

  if (activeHandIndex < playerHands.length) {
    playerHands[activeHandIndex].isActive = true;
    renderGameBoards();
    updateStrategyAdvice();
    updateUI();
  } else {
    playDealerTurn();
  }
}

// --- DEALER TURN ---

async function playDealerTurn() {
  gameState = 'dealer-turn';
  updateUI();

  const allBusted = playerHands.every(hand => hand.isBusted());
  
  // Reveal hole card
  renderDealerHandUI(false);
  sounds.playCardDeal();
  updateCardCounting();
  await sleep(800);

  if (allBusted) {
    resolvePayouts();
    return;
  }

  let dealerScore = dealerHand.getScore();
  
  const shouldDealerHit = () => {
    if (dealerScore < 17) return true;
    if (dealerScore === 17 && dealerHand.isSoft() && settings.dealerSoft17 === 'hit') return true;
    return false;
  };

  while (shouldDealerHit()) {
    dealerHand.addCard(deck.draw());
    sounds.playCardDeal();
    renderDealerHandUI(false);
    updateCardCounting();
    dealerScore = dealerHand.getScore();
    await sleep(750);
  }

  resolvePayouts();
}

// --- PAYOUT RESOLUTION ---

async function resolvePayouts() {
  gameState = 'payout';

  const dealerScore = dealerHand.getScore();
  const dealerBusted = dealerHand.isBusted();
  const dealerBJ = dealerHand.isBlackjack();

  const results = [];
  let handsWonCount = 0;
  let handsLostCount = 0;
  let handsTiedCount = 0;
  let handWinStatus = 'lose';
  let netGain = 0;

  // Reward points accumulators
  let xpGained = 0;

  playerHands.forEach((hand) => {
    const playerScore = hand.getScore();
    xpGained += 10; // +10 XP for playing the hand
    
    if (hand.isBusted()) {
      results.push('bust');
      handsLostCount++;
      netGain -= hand.bet;
    } else if (dealerBusted) {
      results.push('win');
      bankroll += hand.bet * 2;
      handsWonCount++;
      handWinStatus = 'win';
      netGain += hand.bet;
      xpGained += 20; // +20 XP for winning
    } else if (playerScore > dealerScore) {
      results.push('win');
      bankroll += hand.bet * 2;
      handsWonCount++;
      handWinStatus = 'win';
      netGain += hand.bet;
      xpGained += 20; // +20 XP for winning
    } else if (playerScore < dealerScore) {
      results.push('lose');
      handsLostCount++;
      netGain -= hand.bet;
    } else {
      if (hand.isBlackjack() && !dealerBJ) {
        results.push('win');
        bankroll += Math.floor(hand.bet * 2.5);
        handsWonCount++;
        handWinStatus = 'win';
        netGain += Math.floor(hand.bet * 1.5);
        xpGained += 20;
      } else if (dealerBJ && !hand.isBlackjack()) {
        results.push('lose');
        handsLostCount++;
        netGain -= hand.bet;
      } else {
        results.push('push');
        bankroll += hand.bet;
        handsTiedCount++;
        if (handWinStatus !== 'win') handWinStatus = 'push';
      }
    }
  });

  if (insuranceBet > 0) {
    if (dealerBJ) {
      bankroll += insuranceBet * 3;
      netGain += insuranceBet * 2;
    } else {
      netGain -= insuranceBet;
    }
    insuranceBet = 0;
  }

  // Update Game Stats
  stats.handsPlayed += playerHands.length;
  stats.handsWon += handsWonCount;
  stats.handsLost += handsLostCount;
  stats.handsTied += handsTiedCount;

  resolveSessionStats();

  // Play result sound
  if (handWinStatus === 'win') {
    sounds.playWin();
    showStatusMessage(elGameStatusMsg, netGain >= 0 ? `YOU WON $${netGain}!` : `Losses minimized`);
  } else if (handWinStatus === 'push') {
    sounds.playPush();
    showStatusMessage(elGameStatusMsg, "PUSH / TIE");
  } else {
    sounds.playLose();
    showStatusMessage(elGameStatusMsg, `DEALER WINS -$${Math.abs(netGain)}`);
  }

  // Apply XP gains online
  if (userProfile) {
    await rewardXP(xpGained);
  }

  recreatePlayerHandSlots(elPlayerHandsContainer, playerHands, activeHandIndex, results);
  
  // Clean up states
  setTimeout(async () => {
    gameState = 'betting';
    currentBet = 0;
    await saveGameState();
    updateUI();
  }, 1800);
}

function resolveSessionStats() {
  if (bankroll > stats.highestBalance) {
    stats.highestBalance = bankroll;
  }
  stats.netProfit = bankroll - 1000;
}

// --- CORE UI SYNC ---

function updateUI() {
  elDisplayBankroll.textContent = formatCurrency(bankroll);
  elDisplayTotalBet.textContent = formatCurrency(currentBet);

  if (gameState === 'betting') {
    elBettingControls.classList.remove('hidden');
    elGameControls.classList.add('hidden');
    elInsuranceControls.classList.add('hidden');

    elBtnDeal.disabled = currentBet <= 0;
    elBtnClear.disabled = currentBet <= 0;
    elBtnDoubleBet.disabled = (currentBet === 0 && lastBet === 0) || (currentBet > 0 && currentBet * 2 > bankroll && bankroll === currentBet);
  } else if (gameState === 'insurance-prompt') {
    elBettingControls.classList.add('hidden');
    elGameControls.classList.add('hidden');
    elInsuranceControls.classList.remove('hidden');
  } else {
    elBettingControls.classList.add('hidden');
    elGameControls.classList.remove('hidden');
    elInsuranceControls.classList.add('hidden');

    if (gameState === 'player-turn' && playerHands[activeHandIndex]) {
      const hand = playerHands[activeHandIndex];
      elBtnHit.disabled = false;
      elBtnStand.disabled = false;
      elBtnDouble.disabled = hand.cards.length !== 2 || bankroll < hand.bet;
      elBtnSplit.disabled = !hand.isPair() || hand.cards.length !== 2 || playerHands.length >= 4 || bankroll < hand.bet;
    } else {
      elBtnHit.disabled = true;
      elBtnStand.disabled = true;
      elBtnDouble.disabled = true;
      elBtnSplit.disabled = true;
    }
  }

  updateStrategyAdvice();
  updateCardCounting();
}

function renderGameBoards() {
  recreatePlayerHandSlots(elPlayerHandsContainer, playerHands, activeHandIndex);
  const hideHoleCard = (gameState === 'dealing' || gameState === 'player-turn' || gameState === 'insurance-prompt');
  renderDealerHandUI(hideHoleCard);
}

function renderDealerHandUI(hideHoleCard) {
  if (!dealerHand) {
    elDealerCards.innerHTML = '';
    elDealerScore.classList.add('hidden');
    return;
  }
  
  renderHand(elDealerCards, dealerHand, {
    showScore: true,
    hideFirstCard: hideHoleCard,
    isActive: false,
    result: null
  });
  
  elDealerScore.classList.remove('hidden');
  if (hideHoleCard) {
    if (dealerHand.cards.length > 0) {
      const visibleScore = dealerHand.cards[0].rank === 'A' ? 11 : dealerHand.cards[0].value;
      elDealerScore.textContent = visibleScore;
    } else {
      elDealerScore.textContent = '0';
    }
  } else {
    elDealerScore.textContent = dealerHand.getScore();
  }
}

function updateStrategyAdvice() {
  if (!settings.strategy || gameState !== 'player-turn' || !playerHands[activeHandIndex] || !dealerHand) {
    elStrategyAdvice.textContent = 'Place your bet to begin.';
    return;
  }

  const pHand = playerHands[activeHandIndex];
  const dealerUpCard = dealerHand.cards[0];
  const advice = getBasicStrategyAdvice(pHand, dealerUpCard);

  let adviceFull = '';
  switch (advice) {
    case 'Hit': adviceFull = 'Basic Strategy recommends: HIT ⚡'; break;
    case 'Stand': adviceFull = 'Basic Strategy recommends: STAND ✋'; break;
    case 'Double': adviceFull = 'Basic Strategy recommends: DOUBLE DOWN ✖2'; break;
    case 'Split': adviceFull = 'Basic Strategy recommends: SPLIT ✂'; break;
    default: adviceFull = 'Play your hand.';
  }
  
  elStrategyAdvice.textContent = adviceFull;
}

function updateCardCounting() {
  if (!settings.counting || !deck) return;

  elValRunningCount.textContent = deck.runningCount;
  elValRunningCount.className = 'val ' + (deck.runningCount > 0 ? 'positive' : (deck.runningCount < 0 ? 'negative' : 'neutral'));

  elValTrueCount.textContent = deck.trueCount;
  elValTrueCount.className = 'val ' + (deck.trueCount > 0 ? 'positive' : (deck.trueCount < 0 ? 'negative' : 'neutral'));

  elValPenetration.textContent = `${deck.penetrationPercent}%`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Start application
window.addEventListener('load', init);

// Pre-init sounds on first interaction to eliminate tap latency
const resumeAudio = () => {
  sounds.init();
  sounds.resume();
};
window.addEventListener('click', resumeAudio);
window.addEventListener('touchstart', resumeAudio, { passive: true });
window.addEventListener('pointerdown', resumeAudio, { passive: true });
