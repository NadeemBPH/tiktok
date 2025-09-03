const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// Common Chrome user data directories by platform
const CHROME_PATHS = {
  linux: [
    path.join(os.homedir(), '.config', 'google-chrome'),
    path.join(os.homedir(), '.config', 'chromium'),
    path.join(os.homedir(), '.var', 'app', 'com.google.Chrome', 'config', 'google-chrome'),
  ],
  darwin: [
    path.join(os.homedir(), 'Library', 'Application Support', 'Google', 'Chrome'),
    path.join(os.homedir(), 'Library', 'Application Support', 'Chromium'),
  ],
  win32: [
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data'),
    path.join(process.env.APPDATA || '', 'Chromium', 'User Data'),
  ]
};

// Common VPN extension names to search for
const VPN_EXTENSIONS = [
  'tunnelbear', 'windscribe', 'hotspotshield', 'expressvpn', 'nordvpn',
  'protonvpn', 'cyberghost', 'surfshark', 'privateinternetaccess', 'torguard'
];

function findChromeUserData() {
  const platform = os.platform();
  const possiblePaths = CHROME_PATHS[platform] || [];
  
  for (const basePath of possiblePaths) {
    try {
      // Check for Default profile
      const defaultProfile = path.join(basePath, 'Default');
      if (fs.existsSync(defaultProfile)) {
        return defaultProfile;
      }
      
      // Check for other profiles
      const files = fs.readdirSync(basePath);
      const profileDirs = files.filter(file => 
        fs.statSync(path.join(basePath, file)).isDirectory() && 
        file.match(/^Profile|^Default/)
      );
      
      if (profileDirs.length > 0) {
        return path.join(basePath, profileDirs[0]);
      }
    } catch (e) {
      // Continue to next path
    }
  }
  
  return null;
}

function findVpnExtension(userDataDir) {
  if (!userDataDir) return null;
  
  try {
    const extensionsDir = path.join(userDataDir, '..', 'Extensions');
    if (!fs.existsSync(extensionsDir)) return null;
    
    const extensionDirs = fs.readdirSync(extensionsDir);
    
    for (const extId of extensionDirs) {
      const versions = fs.readdirSync(path.join(extensionsDir, extId));
      if (versions.length > 0) {
        const version = versions[0]; // Take the first version
        const manifestPath = path.join(extensionsDir, extId, version, 'manifest.json');
        
        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          const extName = (manifest.name || '').toLowerCase();
          
          if (VPN_EXTENSIONS.some(vpn => extName.includes(vpn))) {
            return path.join(extensionsDir, extId, version);
          }
        } catch (e) {
          // Skip invalid manifests
        }
      }
    }
  } catch (e) {
    console.error('Error finding VPN extension:', e.message);
  }
  
  return null;
}

// Main function
function findChromePaths() {
  console.log('🔍 Searching for Chrome/Chromium user data directory...');
  const userDataDir = findChromeUserData();
  
  if (userDataDir) {
    console.log('✅ Found Chrome user data directory:');
    console.log(`   ${userDataDir}`);
    
    console.log('\n🔍 Searching for VPN extensions...');
    const vpnExtensionDir = findVpnExtension(userDataDir);
    
    if (vpnExtensionDir) {
      console.log('✅ Found VPN extension:');
      console.log(`   ${vpnExtensionDir}`);
    } else {
      console.log('❌ No VPN extension found in Chrome extensions');
    }
    
    return { userDataDir, vpnExtensionDir };
  } else {
    console.log('❌ Could not find Chrome/Chromium user data directory');
    return { userDataDir: null, vpnExtensionDir: null };
  }
}

// Export for use in other files
module.exports = { findChromePaths };

// Run directly if this file is executed
if (require.main === module) {
  findChromePaths();
}
