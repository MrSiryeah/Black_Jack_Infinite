// Dynamic Debug Console Overlay for Remote Debugging
const logs = [];
let debugContainer = null;
let logList = null;

// Save original consoles
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

function addLog(type, ...args) {
  const msg = args.map(arg => {
    if (arg instanceof Error) return arg.message + '\n' + arg.stack;
    return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
  }).join(' ');
  
  logs.push({ type, msg, time: new Date().toLocaleTimeString() });
  if (logs.length > 50) logs.shift();
  
  updateDebugUI();
}

// Override console methods
console.log = (...args) => {
  originalLog.apply(console, args);
  addLog('log', ...args);
};
console.warn = (...args) => {
  originalWarn.apply(console, args);
  addLog('warn', ...args);
};
console.error = (...args) => {
  originalError.apply(console, args);
  addLog('error', ...args);
};

// Handle unhandled errors
window.addEventListener('error', (event) => {
  addLog('error', 'Unhandled Exception: ' + event.message + ' at ' + event.filename + ':' + event.lineno);
});
window.addEventListener('unhandledrejection', (event) => {
  addLog('error', 'Unhandled Promise Rejection: ' + event.reason);
});

function createDebugUI() {
  if (debugContainer) return;
  
  debugContainer = document.createElement('div');
  debugContainer.id = 'debug-console';
  debugContainer.style.position = 'fixed';
  debugContainer.style.bottom = '10px';
  debugContainer.style.left = '10px';
  debugContainer.style.zIndex = '999999';
  debugContainer.style.width = '320px';
  debugContainer.style.maxHeight = '200px';
  debugContainer.style.backgroundColor = 'rgba(15, 23, 42, 0.95)';
  debugContainer.style.border = '1px solid rgba(255, 255, 255, 0.15)';
  debugContainer.style.borderRadius = '8px';
  debugContainer.style.fontFamily = 'monospace';
  debugContainer.style.fontSize = '10px';
  debugContainer.style.color = '#fff';
  debugContainer.style.display = 'flex';
  debugContainer.style.flexDirection = 'column';
  debugContainer.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.5)';
  debugContainer.style.overflow = 'hidden';
  debugContainer.style.transition = 'all 0.3s ease';

  const header = document.createElement('div');
  header.style.padding = '6px 10px';
  header.style.backgroundColor = 'rgba(30, 41, 59, 0.8)';
  header.style.borderBottom = '1px solid rgba(255, 255, 255, 0.1)';
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  header.style.cursor = 'pointer';

  const title = document.createElement('span');
  title.textContent = '🛠️ Developer Log';
  title.style.fontWeight = 'bold';
  title.style.color = '#d4af37';

  const controls = document.createElement('div');
  controls.style.display = 'flex';
  controls.style.gap = '8px';

  const clearBtn = document.createElement('span');
  clearBtn.textContent = 'Clear';
  clearBtn.style.textDecoration = 'underline';
  clearBtn.style.cursor = 'pointer';
  clearBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    logs.length = 0;
    updateDebugUI();
  });

  const toggleBtn = document.createElement('span');
  toggleBtn.textContent = '▼';
  toggleBtn.style.cursor = 'pointer';

  controls.appendChild(clearBtn);
  controls.appendChild(toggleBtn);
  header.appendChild(title);
  header.appendChild(controls);
  debugContainer.appendChild(header);

  logList = document.createElement('div');
  logList.style.flex = '1';
  logList.style.overflowY = 'auto';
  logList.style.padding = '6px 10px';
  logList.style.display = 'flex';
  logList.style.flexDirection = 'column';
  logList.style.gap = '4px';
  debugContainer.appendChild(logList);

  document.body.appendChild(debugContainer);

  let isCollapsed = true;
  debugContainer.style.height = '30px';
  logList.style.display = 'none';
  toggleBtn.textContent = '▲';

  header.addEventListener('click', () => {
    isCollapsed = !isCollapsed;
    if (isCollapsed) {
      debugContainer.style.height = '30px';
      logList.style.display = 'none';
      toggleBtn.textContent = '▲';
    } else {
      debugContainer.style.height = '200px';
      logList.style.display = 'block';
      toggleBtn.textContent = '▼';
      logList.scrollTop = logList.scrollHeight;
    }
  });
}

function updateDebugUI() {
  if (!logList) return;
  
  logList.innerHTML = '';
  logs.forEach(log => {
    const item = document.createElement('div');
    item.style.lineHeight = '1.3';
    item.style.whiteSpace = 'pre-wrap';
    item.style.wordBreak = 'break-all';
    item.style.borderBottom = '1px solid rgba(255, 255, 255, 0.05)';
    item.style.paddingBottom = '3px';
    
    let color = '#ccc';
    if (log.type === 'error') color = '#ef4444';
    else if (log.type === 'warn') color = '#f59e0b';
    else if (log.type === 'log' && (log.msg.includes('success') || log.msg.includes('Connected'))) color = '#10b981';
    
    item.innerHTML = `<span style="color: #64748b">[${log.time}]</span> <span style="color: ${color}">${log.msg}</span>`;
    logList.appendChild(item);
  });
  
  logList.scrollTop = logList.scrollHeight;
}

// Auto load UI
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', createDebugUI);
} else {
  createDebugUI();
}

console.log("Debug logger initialized.");
