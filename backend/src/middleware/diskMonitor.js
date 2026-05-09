const { execSync } = require('child_process');

let lastCheck = 0;
let lastUsage = 0;

function getDiskUsagePercent() {
  try {
    const out = execSync("df / --output=pcent | tail -1").toString().trim().replace('%', '');
    return parseInt(out, 10);
  } catch {
    return 0;
  }
}

// Force refresh disk cache (call after clear operations)
function refreshDiskCache() {
  lastUsage = getDiskUsagePercent();
  lastCheck = Date.now();
  return lastUsage;
}

function checkDiskUsage(req, res, next) {
  const now = Date.now();
  if (now - lastCheck > 30000) { // check every 30 seconds
    lastUsage = getDiskUsagePercent();
    lastCheck = now;
  }

  res.setHeader('X-Disk-Usage', lastUsage);

  if (lastUsage >= 95 && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const whitelistPaths = ['/api/system/export', '/api/system/clear', '/api/auth'];
    if (!whitelistPaths.some(p => req.path.startsWith(p))) {
      return res.status(507).json({
        error: 'Диск заполнен',
        diskUsage: lastUsage,
        message: 'Сервер заполнен на 95%. Выгрузите данные и очистите базу для продолжения работы.'
      });
    }
  }

  next();
}

module.exports = { checkDiskUsage, getDiskUsagePercent, refreshDiskCache };
