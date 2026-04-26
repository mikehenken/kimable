#!/usr/bin/env node

/**
 * Kimable Install Script
 *
 * Usage:
 *   Interactive:       npx github:mikehenken/kimable-simple-agent
 *   Non-interactive:   npx github:mikehenken/kimable-simple-agent --all
 *   Select specific:   npx github:mikehenken/kimable-simple-agent --claude --kimi
 *   Skip detection:    npx github:mikehenken/kimable-simple-agent --claude --claude-path ~/custom/.claude
 *
 * Options:
 *   -a, --all           Install everything for all detected platforms
 *   -y, --yes           Auto-confirm all prompts (implies --all for detected)
 *   --claude            Install Claude agent
 *   --cursor            Install Cursor agent
 *   --opencode          Install OpenCode agent
 *   --kimi              Install/update Kimable orchestrator
 *   --install-kimi-cli  Install Kimi CLI if missing
 *   --claude-path PATH  Custom Claude agents directory
 *   --cursor-path PATH  Custom Cursor agents directory
 *   --opencode-path PATH Custom OpenCode agents directory
 *   --kimable-path PATH Custom Kimable install directory
 *   --dry-run           Show what would be installed without doing it
 *   -h, --help          Show this message
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
const https = require('https');

const REPO = 'https://github.com/mikehenken/kimable-simple-agent';
const RAW = 'https://raw.githubusercontent.com/mikehenken/kimable-simple-agent/main';
const DEFAULT_KIMABLE_DIR = path.join(os.homedir(), '.kimable');
const KIMI_INSTALL_URL = 'https://www.kimi.com/code/install.sh';

// Colors
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgGreen: '\x1b[42m',
  bgRed: '\x1b[41m',
};

function log(label, msg, color = C.reset) {
  console.log(`${color}${C.bold}[${label}]${C.reset} ${msg}`);
}

function section(title) {
  console.log('');
  console.log(`${C.cyan}${C.bold}═══ ${title} ═══${C.reset}`);
  console.log('');
}

function prompt(msg) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`${C.yellow}${C.bold}?${C.reset} ${msg} `, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, response => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${url}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', reject);
  });
}

function exists(cmd) {
  try { execSync(`which ${cmd}`, { stdio: 'ignore' }); return true; } catch { return false; }
}

function isDir(p) {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}

// ─── Platform Detection ───

const PLATFORMS = {
  claude: {
    name: 'Claude Code',
    detect: () => isDir(path.join(os.homedir(), '.claude')) || exists('claude'),
    defaultAgentDir: () => path.join(os.homedir(), '.claude', 'agents'),
    agentFile: 'agents/kimi-delegate.md',
  },
  cursor: {
    name: 'Cursor',
    detect: () => isDir(path.join(os.homedir(), '.cursor')) || exists('cursor'),
    defaultAgentDir: () => {
      // Cursor reads Claude agents if configured, but has its own too
      const cursorDir = path.join(os.homedir(), '.cursor', 'agents');
      const claudeDir = path.join(os.homedir(), '.claude', 'agents');
      if (isDir(cursorDir)) return cursorDir;
      if (isDir(claudeDir)) return claudeDir;
      return cursorDir; // fallback to cursor's own
    },
    agentFile: 'agents/kimi-delegate.md',
  },
  opencode: {
    name: 'OpenCode',
    detect: () => isDir(path.join(os.homedir(), '.config', 'opencode')) || exists('opencode'),
    defaultAgentDir: () => path.join(os.homedir(), '.config', 'opencode', 'agents'),
    agentFile: 'agents/kimi-delegate.md',
  },
  kimi: {
    name: 'Kimi CLI / Orchestrator',
    detect: () => exists('kimi'),
    defaultAgentDir: () => DEFAULT_KIMABLE_DIR,
    agentFile: null, // orchestrator is different
  },
};

// ─── Checkbox UI ───

class CheckboxUI {
  constructor(items) {
    this.items = items; // [{ key, name, checked, detected, path }]
    this.cursor = 0;
  }

  render() {
    console.clear();
    console.log(`${C.cyan}${C.bold}Kimable Installer${C.reset}`);
    console.log(`${C.dim}Select platforms to install (spacebar to toggle, enter to confirm)${C.reset}`);
    console.log('');
    this.items.forEach((item, i) => {
      const cursor = i === this.cursor ? `${C.yellow}>${C.reset}` : ' ';
      const checked = item.checked ? `${C.green}[x]${C.reset}` : `${C.dim}[ ]${C.reset}`;
      const detected = item.detected ? `${C.dim}(detected)${C.reset}` : `${C.yellow}(not detected)${C.reset}`;
      const path = item.path ? `${C.dim}→ ${item.path}${C.reset}` : '';
      console.log(`  ${cursor} ${checked} ${C.bold}${item.name}${C.reset} ${detected} ${path}`);
    });
    console.log('');
    console.log(`${C.dim}  ↑↓ move  space toggle  enter confirm  q quit${C.reset}`);
  }

  async run() {
    return new Promise(resolve => {
      const stdin = process.stdin;
      stdin.setRawMode(true);
      stdin.resume();
      stdin.setEncoding('utf8');

      const onKey = (key) => {
        if (key === 'q' || key === '\u0003') { // q or ctrl+c
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener('data', onKey);
          resolve(null);
          return;
        }
        if (key === '\r' || key === '\n') { // enter
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener('data', onKey);
          resolve(this.items);
          return;
        }
        if (key === ' ') { // spacebar toggle
          this.items[this.cursor].checked = !this.items[this.cursor].checked;
        }
        if (key === '\u001b[A') { // up
          this.cursor = (this.cursor - 1 + this.items.length) % this.items.length;
        }
        if (key === '\u001b[B') { // down
          this.cursor = (this.cursor + 1) % this.items.length;
        }
        this.render();
      };

      stdin.on('data', onKey);
      this.render();
    });
  }
}

// ─── Main ───

async function main() {
  const args = process.argv.slice(2);

  // Parse flags
  const flags = {
    all: args.includes('-a') || args.includes('--all'),
    yes: args.includes('-y') || args.includes('--yes'),
    claude: args.includes('--claude'),
    cursor: args.includes('--cursor'),
    opencode: args.includes('--opencode'),
    kimi: args.includes('--kimi'),
    installKimiCli: args.includes('--install-kimi-cli'),
    dryRun: args.includes('--dry-run'),
    help: args.includes('-h') || args.includes('--help'),
  };

  // Parse path overrides
  const getPath = (flag) => {
    const idx = args.indexOf(flag);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
  };
  const customPaths = {
    claude: getPath('--claude-path'),
    cursor: getPath('--cursor-path'),
    opencode: getPath('--opencode-path'),
    kimi: getPath('--kimable-path'),
  };

  if (flags.help) {
    console.log(`
${C.cyan}${C.bold}Kimable Installer${C.reset}

Install the Kimable multi-agent orchestrator and IDE agents.

${C.bold}Interactive mode:${C.reset}
  npx github:mikehenken/kimable-simple-agent

${C.bold}Non-interactive:${C.reset}
  npx github:mikehenken/kimable-simple-agent --all
  npx github:mikehenken/kimable-simple-agent --claude --kimi
  npx github:mikehenken/kimable-simple-agent --yes

${C.bold}Options:${C.reset}
  -a, --all            Install for all detected platforms
  -y, --yes            Auto-confirm, skip prompts
  --claude             Install Claude agent
  --cursor             Install Cursor agent
  --opencode           Install OpenCode agent
  --kimi               Install Kimable orchestrator
  --install-kimi-cli   Install Kimi CLI if missing
  --claude-path PATH   Custom Claude agents directory
  --cursor-path PATH   Custom Cursor agents directory
  --opencode-path PATH Custom OpenCode agents directory
  --kimable-path PATH  Custom Kimable install directory
  --dry-run            Show what would be installed
  -h, --help           Show this message
`);
    process.exit(0);
  }

  section('Platform Detection');

  const detections = {};
  for (const [key, cfg] of Object.entries(PLATFORMS)) {
    const detected = cfg.detect();
    const defaultPath = cfg.defaultAgentDir();
    const customPath = customPaths[key];
    const finalPath = customPath || defaultPath;
    detections[key] = { detected, defaultPath, finalPath };
    log(detected ? 'FOUND' : 'MISSING', `${cfg.name} → ${finalPath}`, detected ? C.green : C.yellow);
  }

  // Build checkbox items
  const items = Object.entries(PLATFORMS).map(([key, cfg]) => ({
    key,
    name: cfg.name,
    checked: detections[key].detected,
    detected: detections[key].detected,
    path: detections[key].finalPath,
  }));

  let selected = [];

  // Non-interactive mode
  if (flags.all || flags.yes || flags.claude || flags.cursor || flags.opencode || flags.kimi) {
    if (flags.all || flags.yes) {
      selected = items.filter(i => i.detected);
    } else {
      selected = items.filter(i => {
        if (i.key === 'claude' && flags.claude) return true;
        if (i.key === 'cursor' && flags.cursor) return true;
        if (i.key === 'opencode' && flags.opencode) return true;
        if (i.key === 'kimi' && flags.kimi) return true;
        return false;
      });
    }

    // Auto-select kimi if any IDE agent selected and kimi not already in list
    if (selected.length > 0 && !selected.find(i => i.key === 'kimi')) {
      items.find(i => i.key === 'kimi').checked = true;
      selected = items.filter(i => i.checked);
    }
  } else {
    // Interactive mode
    const result = await new CheckboxUI(items).run();
    if (result === null) {
      console.log('\nCancelled.');
      process.exit(0);
    }
    selected = result.filter(i => i.checked);
  }

  if (selected.length === 0) {
    log('ERROR', 'Nothing selected to install.', C.red);
    process.exit(1);
  }

  // Check for kimi-cli install
  const needsKimi = selected.find(i => i.key === 'kimi');
  const hasKimi = detections.kimi.detected;
  if (needsKimi && !hasKimi && !flags.installKimiCli && !flags.yes) {
    const ans = await prompt('Kimi CLI not found. Install it now? [Y/n]');
    if (ans === '' || ans.toLowerCase() === 'y') {
      flags.installKimiCli = true;
    }
  }

  if (flags.installKimiCli && !hasKimi) {
    section('Installing Kimi CLI');
    if (flags.dryRun) {
      log('DRY', `Would run: curl -fsSL ${KIMI_INSTALL_URL} | bash`, C.yellow);
    } else {
      try {
        execSync(`curl -fsSL ${KIMI_INSTALL_URL} | bash`, { stdio: 'inherit' });
        log('OK', 'Kimi CLI installed', C.green);
      } catch (e) {
        log('ERROR', `Kimi CLI install failed: ${e.message}`, C.red);
        process.exit(1);
      }
    }
  }

  // Custom paths for undetected platforms
  for (const item of selected) {
    if (!item.detected && !customPaths[item.key] && !flags.yes) {
      const cfg = PLATFORMS[item.key];
      const ans = await prompt(`${cfg.name} not detected. Install to ${item.path}? [Y/n/custom-path]`);
      if (ans.toLowerCase() === 'n') {
        item.skip = true;
      } else if (ans && ans !== 'y' && ans !== 'Y' && ans !== '') {
        item.path = ans.replace(/^~/, os.homedir());
      }
    }
  }

  const toInstall = selected.filter(i => !i.skip);

  // ─── Install ───
  section('Installing');

  for (const item of toInstall) {
    const cfg = PLATFORMS[item.key];

    if (item.key === 'kimi') {
      // Orchestrator install
      const dest = item.path;
      if (flags.dryRun) {
        log('DRY', `Would clone orchestrator to ${dest}`, C.yellow);
        continue;
      }

      if (isDir(dest)) {
        log('SKIP', `Orchestrator already at ${dest}`, C.yellow);
      } else {
        try {
          execSync(`git clone --depth 1 ${REPO}.git ${dest}`, { stdio: 'pipe' });
          // Clean up unnecessary files
          const cleanFiles = ['.git', 'README.md', 'CHANGELOG.md', 'AGENTS.md', 'blog-post', 'examples', 'PACKAGING.md'];
          for (const f of cleanFiles) {
            const p = path.join(dest, f);
            if (fs.existsSync(p)) {
              fs.rmSync(p, { recursive: true, force: true });
            }
          }
          log('OK', `Orchestrator → ${dest}`, C.green);
        } catch (e) {
          log('ERROR', `Clone failed: ${e.message}`, C.red);
        }
      }
    } else {
      // Agent install
      const agentDir = item.path;

      if (flags.dryRun) {
        log('DRY', `Would create ${agentDir} and download agent`, C.yellow);
        continue;
      }

      if (!isDir(agentDir)) {
        fs.mkdirSync(agentDir, { recursive: true });
      }

      const agentDest = path.join(agentDir, 'kimi-delegate.md');
      try {
        await download(`${RAW}/${cfg.agentFile}`, agentDest);
        log('OK', `${cfg.name} agent → ${agentDest}`, C.green);
      } catch (e) {
        log('ERROR', `Download failed for ${cfg.name}: ${e.message}`, C.red);
      }
    }
  }

  // ─── Validation ───
  section('Validation');

  const kimiPath = toInstall.find(i => i.key === 'kimi')?.path || DEFAULT_KIMABLE_DIR;
  let allGood = true;

  // Check kimi.yaml exists
  if (fs.existsSync(path.join(kimiPath, 'kimable.yaml'))) {
    log('PASS', 'kimable.yaml found', C.green);
  } else {
    log('FAIL', 'kimable.yaml missing', C.red);
    allGood = false;
  }

  // Check orchestrator system.md
  if (fs.existsSync(path.join(kimiPath, 'orchestrator', 'system.md'))) {
    log('PASS', 'orchestrator/system.md found', C.green);
  } else {
    log('FAIL', 'orchestrator/system.md missing', C.red);
    allGood = false;
  }

  // Check subagents count
  const subagentsDir = path.join(kimiPath, 'subagents');
  if (isDir(subagentsDir)) {
    const count = fs.readdirSync(subagentsDir).filter(d => fs.statSync(path.join(subagentsDir, d)).isDirectory()).length;
    log('PASS', `${count} subagents found`, C.green);
  } else {
    log('FAIL', 'subagents/ directory missing', C.red);
    allGood = false;
  }

  // Check agent files for selected platforms
  for (const item of toInstall.filter(i => i.key !== 'kimi')) {
    const agentFile = path.join(item.path, 'kimi-delegate.md');
    if (fs.existsSync(agentFile)) {
      log('PASS', `${PLATFORMS[item.key].name} agent installed`, C.green);
    } else {
      log('FAIL', `${PLATFORMS[item.key].name} agent missing`, C.red);
      allGood = false;
    }
  }

  // ─── Summary ───
  section('Summary');

  if (allGood) {
    console.log(`${C.green}${C.bold}All checks passed. Kimable is ready.${C.reset}`);
  } else {
    console.log(`${C.yellow}${C.bold}Some checks failed. Review errors above.${C.reset}`);
  }

  console.log('');
  console.log(`${C.dim}Quick start:${C.reset}`);
  if (toInstall.find(i => i.key === 'claude')) {
    console.log(`  ${C.dim}Claude Code: @kimi-delegate write tests for auth${C.reset}`);
  }
  if (toInstall.find(i => i.key === 'cursor')) {
    console.log(`  ${C.dim}Cursor: CMD+SHIFT+P → "Delegate to Kimable"${C.reset}`);
  }
  if (toInstall.find(i => i.key === 'opencode')) {
    console.log(`  ${C.dim}OpenCode: !delegate write tests for auth${C.reset}`);
  }
  if (toInstall.find(i => i.key === 'kimi')) {
    console.log(`  ${C.dim}Kimi CLI: kimi --agent ${kimiPath}/kimable.yaml --prompt "task"${C.reset}`);
  }
  console.log('');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
