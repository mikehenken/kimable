#!/usr/bin/env node

/**
 * Kimable Install Script
 * 
 * Usage:
 *   npx github:mikehenken/kimable-simple-agent
 *   npx github:mikehenken/kimable-simple-agent --claude
 *   npx github:mikehenken/kimable-simple-agent --global
 * 
 * Options:
 *   --claude     Install only the Claude Code subagent
 *   --global     Install system-wide (requires sudo)
 *   --check      Run validation after install
 *   --help       Show this message
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO = 'https://github.com/mikehenken/kimable-simple-agent.git';
const INSTALL_DIR = process.argv.includes('--global') ? '/opt/kimable' : path.join(os.homedir(), '.kimable');

function run(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf8', stdio: opts.silent ? 'pipe' : 'inherit', ...opts });
}

function log(msg) {
  console.log(`[kimable-install] ${msg}`);
}

if (process.argv.includes('--help')) {
  console.log(`
Kimable Install Script

Usage:
  npx github:mikehenken/kimable-simple-agent        Install to ~/.kimable
  npx github:mikehenken/kimable-simple-agent --global Install to /opt/kimable
  npx github:mikehenken/kimable-simple-agent --claude Install only Claude subagent
  npx github:mikehenken/kimable-simple-agent --check  Validate after install

Options:
  --claude     Install only the Claude Code subagent (kimi-delegate.md)
  --global     System-wide install to /opt/kimable (requires write permission)
  --check      Run pipeline validation after install
  --help       Show this message

Security:
  This script is scanned by Socket.dev (https://socket.dev)
  For manual verification: curl -s https://api.socket.dev/v0/npm/github/mikehenken/kimable-simple-agent
`);
  process.exit(0);
}

// Check prerequisites
log('Checking prerequisites...');

try {
  run('git --version', { silent: true });
} catch {
  console.error('git is required but not installed. Install git first.');
  process.exit(1);
}

// Clone or update
if (fs.existsSync(INSTALL_DIR)) {
  log(`Updating existing install at ${INSTALL_DIR}...`);
  run(`cd ${INSTALL_DIR} && git pull --ff-only`);
} else {
  log(`Cloning to ${INSTALL_DIR}...`);
  run(`git clone --depth 1 ${REPO} ${INSTALL_DIR}`);
}

// Install Claude subagent if requested
if (process.argv.includes('--claude') || !process.argv.includes('--global')) {
  const claudeDir = path.join(os.homedir(), '.claude', 'agents');
  if (!fs.existsSync(claudeDir)) {
    fs.mkdirSync(claudeDir, { recursive: true });
  }
  
  const src = path.join(INSTALL_DIR, 'claude-integration', 'kimi-delegate.md');
  const dest = path.join(claudeDir, 'kimi-delegate.md');
  
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    log(`Installed Claude subagent to ${dest}`);
  }
}

// Global symlink
if (process.argv.includes('--global')) {
  const binDir = '/usr/local/bin';
  const binTarget = path.join(INSTALL_DIR, 'scripts', 'test.js');
  const binLink = path.join(binDir, 'kimable-test');
  
  try {
    if (fs.existsSync(binLink)) fs.unlinkSync(binLink);
    fs.symlinkSync(binTarget, binLink);
    log(`Symlinked ${binLink} → ${binTarget}`);
  } catch (e) {
    console.error(`Failed to create symlink. Run with sudo, or use ~/.kimable install.`);
    process.exit(1);
  }
}

// Shell alias suggestion
const rcFile = process.env.SHELL?.includes('zsh') ? '~/.zshrc' : '~/.bashrc';
log('');
log('Add to your shell config for convenience:');
log(`  echo 'alias kb="kimi --agent ${INSTALL_DIR}/kimable.yaml"' >> ${rcFile}`);
log('');

// Check
if (process.argv.includes('--check')) {
  log('Running validation...');
  const testScript = path.join(INSTALL_DIR, 'scripts', 'test.js');
  if (fs.existsSync(testScript)) {
    run(`node ${testScript}`);
  } else {
    console.error('Test script not found. Something went wrong.');
    process.exit(1);
  }
}

log('Done.');
log(`Repository: ${INSTALL_DIR}`);
log(`Claude agent: ~/.claude/agents/kimi-delegate.md`);
log('');
log('Quick start:');
log(`  kimi --agent ${INSTALL_DIR}/kimable.yaml --prompt "your task"`);
