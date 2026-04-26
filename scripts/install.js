#!/usr/bin/env node

// Kimable installer.
//
// Usage:
//   npx github:mikehenken/kimable
//   npx github:mikehenken/kimable --yes
//   npx github:mikehenken/kimable --skip-kimi-cli
//   npx github:mikehenken/kimable --update
//
// Flags:
//   -y, --yes         Non-interactive; accept defaults.
//   --skip-kimi-cli   Don't install the kimi CLI even if missing.
//   --update          Pull latest into existing ~/.kimable.
//   --dry-run         Print actions without performing them.
//   -h, --help        Show this message.
//
// What it does:
//   1. Verifies prerequisites (git, node).
//   2. Installs the kimi CLI if missing (skipped on Windows; print manual steps).
//   3. Clones (or updates) ~/.kimable so kimable.yaml + subagents are available locally.
//   4. Prints next steps for installing the Claude Code plugin.

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

const REPO_URL = 'https://github.com/mikehenken/kimable.git';
const KIMI_INSTALL_URL = 'https://www.kimi.com/code/install.sh';
const KIMABLE_DIR = process.env.KIMABLE_HOME || path.join(os.homedir(), '.kimable');

const C = process.stdout.isTTY
  ? {
      reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
      red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m',
    }
  : { reset: '', bold: '', dim: '', red: '', green: '', yellow: '', cyan: '' };

// ─── tiny helpers ─────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flags = {
  yes:          args.includes('-y') || args.includes('--yes'),
  skipKimiCli:  args.includes('--skip-kimi-cli'),
  update:       args.includes('--update'),
  dryRun:       args.includes('--dry-run'),
  help:         args.includes('-h') || args.includes('--help'),
};

function log(level, msg) {
  const colors = { info: C.cyan, ok: C.green, warn: C.yellow, err: C.red, dim: C.dim };
  const labels = { info: 'INFO', ok: 'OK', warn: 'WARN', err: 'ERR', dim: '...' };
  console.log(`${colors[level]}${C.bold}[${labels[level]}]${C.reset} ${msg}`);
}

function section(title) {
  console.log(`\n${C.cyan}${C.bold}━━ ${title} ━━${C.reset}`);
}

function which(cmd) {
  const lookup = process.platform === 'win32' ? `where ${cmd}` : `command -v ${cmd}`;
  try { execSync(lookup, { stdio: 'ignore' }); return true; }
  catch { return false; }
}

function run(cmd, opts = {}) {
  if (flags.dryRun) { log('dim', `would run: ${cmd}`); return ''; }
  return execSync(cmd, { stdio: opts.silent ? 'pipe' : 'inherit', encoding: 'utf8' });
}

function ask(question, defaultYes = true) {
  if (flags.yes) return defaultYes;
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const suffix = defaultYes ? ' [Y/n] ' : ' [y/N] ';
    rl.question(`${C.yellow}?${C.reset} ${question}${suffix}`, (ans) => {
      rl.close();
      const a = ans.trim().toLowerCase();
      if (a === '') resolve(defaultYes);
      else resolve(a === 'y' || a === 'yes');
    });
  });
}

function showHelp() {
  console.log(`
${C.cyan}${C.bold}Kimable installer${C.reset}

  Installs the kimi CLI (if missing) and clones the Kimable orchestrator
  to ~/.kimable so kimable.yaml and the 14 subagents are available locally.

${C.bold}Usage${C.reset}
  npx github:mikehenken/kimable [flags]

${C.bold}Flags${C.reset}
  -y, --yes           Non-interactive; accept defaults.
  --skip-kimi-cli     Skip the kimi CLI install step.
  --update            Pull latest into an existing ~/.kimable instead of cloning.
  --dry-run           Print actions without performing them.
  -h, --help          Show this message.

${C.bold}Environment${C.reset}
  KIMABLE_HOME        Override install location (default: ~/.kimable).

${C.bold}After install${C.reset}
  Add the plugin to Claude Code:
    claude plugin marketplace add github:mikehenken/kimable
    /plugin install kimable-delegate
`);
}

// ─── steps ─────────────────────────────────────────────────────────────

function checkPrereqs() {
  section('Prerequisites');
  const missing = [];
  if (!which('git'))  missing.push('git');
  if (!which('node')) missing.push('node');
  if (missing.length) {
    log('err', `Missing required tools: ${missing.join(', ')}. Install them and re-run.`);
    process.exit(1);
  }
  log('ok', 'git + node found');
}

async function installKimiCli() {
  section('Kimi CLI');
  if (which('kimi')) {
    log('ok', 'kimi already installed');
    return;
  }
  if (flags.skipKimiCli) {
    log('warn', 'kimi not found; --skip-kimi-cli set, continuing');
    return;
  }
  if (process.platform === 'win32') {
    log('warn', 'kimi installer is bash-only. Install manually under WSL or via the kimi.com instructions.');
    log('dim',  `See: ${KIMI_INSTALL_URL}`);
    return;
  }
  if (!which('curl')) {
    log('warn', 'curl not found; cannot auto-install kimi. Install kimi manually:');
    log('dim',  `  curl -fsSL ${KIMI_INSTALL_URL} | bash`);
    return;
  }
  const yes = await ask('kimi CLI not found. Install it now?', true);
  if (!yes) { log('warn', 'Skipping kimi install. You can run the curl command later.'); return; }

  try {
    run(`curl -fsSL ${KIMI_INSTALL_URL} | bash`);
    if (which('kimi')) log('ok', 'kimi installed');
    else log('warn', 'Installer ran but `kimi` is not on PATH. Restart your shell or update PATH.');
  } catch (e) {
    log('err', `kimi install failed: ${e.message}`);
    log('dim', `Manual install: curl -fsSL ${KIMI_INSTALL_URL} | bash`);
  }
}

async function syncRepo() {
  section('Orchestrator');
  const exists = fs.existsSync(KIMABLE_DIR);
  const isGitRepo = exists && fs.existsSync(path.join(KIMABLE_DIR, '.git'));

  if (exists && !isGitRepo) {
    log('err', `${KIMABLE_DIR} exists but is not a git checkout. Move or remove it and re-run.`);
    process.exit(1);
  }

  if (isGitRepo) {
    if (flags.update || await ask(`Update existing checkout at ${KIMABLE_DIR}?`, true)) {
      try {
        run(`git -C "${KIMABLE_DIR}" pull --ff-only`, { silent: false });
        log('ok', `Updated ${KIMABLE_DIR}`);
      } catch (e) {
        log('err', `git pull failed: ${e.message}`);
        process.exit(1);
      }
    } else {
      log('dim', 'Leaving existing checkout untouched.');
    }
    return;
  }

  // Fresh clone
  fs.mkdirSync(path.dirname(KIMABLE_DIR), { recursive: true });
  try {
    run(`git clone --depth 1 ${REPO_URL} "${KIMABLE_DIR}"`);
    log('ok', `Cloned to ${KIMABLE_DIR}`);
  } catch (e) {
    log('err', `git clone failed: ${e.message}`);
    process.exit(1);
  }
}

// ─── Claude Code wiring ────────────────────────────────────────────────

const CLAUDE_DIR    = path.join(os.homedir(), '.claude');
const CLAUDE_AGENTS = path.join(CLAUDE_DIR, 'agents');
const CLAUDE_HOOKS  = path.join(CLAUDE_DIR, 'hooks');
const CLAUDE_SETTINGS = path.join(CLAUDE_DIR, 'settings.json');
const HOOK_TARGET   = path.join(CLAUDE_HOOKS, 'kimable-auto.sh');

function claudeDetected() {
  return fs.existsSync(CLAUDE_DIR) || which('claude');
}

function copyFile(src, dst) {
  if (flags.dryRun) { log('dim', `would copy ${src} -> ${dst}`); return; }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

async function installClaudeAgents() {
  const srcDir = path.join(KIMABLE_DIR, 'agents');
  if (!fs.existsSync(srcDir)) { log('warn', 'agents/ missing in checkout; skipping'); return; }

  const yes = await ask(`Install agents into ${CLAUDE_AGENTS}?`, true);
  if (!yes) { log('dim', 'Skipped agent install.'); return; }

  for (const name of fs.readdirSync(srcDir)) {
    if (!name.endsWith('.md')) continue;
    copyFile(path.join(srcDir, name), path.join(CLAUDE_AGENTS, name));
    log('ok', `agent → ${path.join(CLAUDE_AGENTS, name)}`);
  }
}

async function installClaudeHook() {
  const src = path.join(KIMABLE_DIR, 'hooks', 'claude-auto.sh');
  if (!fs.existsSync(src)) { log('warn', 'hooks/claude-auto.sh missing in checkout; skipping'); return; }

  const yes = await ask('Install the optional context hook into Claude Code?', false);
  if (!yes) { log('dim', 'Skipped hook install.'); return; }

  copyFile(src, HOOK_TARGET);
  if (!flags.dryRun) {
    try { fs.chmodSync(HOOK_TARGET, 0o755); } catch (_) {}
  }
  log('ok', `hook → ${HOOK_TARGET}`);

  // Register in settings.json (idempotent)
  if (flags.dryRun) { log('dim', `would register hook in ${CLAUDE_SETTINGS}`); return; }

  let settings = {};
  if (fs.existsSync(CLAUDE_SETTINGS)) {
    try { settings = JSON.parse(fs.readFileSync(CLAUDE_SETTINGS, 'utf8')); }
    catch (e) {
      log('warn', `Could not parse ${CLAUDE_SETTINGS}; not modifying. Add manually:`);
      log('dim',  `  { "hooks": { "UserPromptSubmit": [ { "type": "command", "command": "${HOOK_TARGET}" } ] } }`);
      return;
    }
  }
  settings.hooks = settings.hooks || {};
  settings.hooks.UserPromptSubmit = settings.hooks.UserPromptSubmit || [];
  const already = settings.hooks.UserPromptSubmit.some(
    (h) => h && h.command && h.command.includes('kimable-auto.sh')
  );
  if (already) {
    log('ok', 'hook already registered in settings.json');
  } else {
    settings.hooks.UserPromptSubmit.push({ type: 'command', command: HOOK_TARGET });
    fs.writeFileSync(CLAUDE_SETTINGS, JSON.stringify(settings, null, 2) + '\n');
    log('ok', `registered hook in ${CLAUDE_SETTINGS}`);
  }
  log('dim', 'Enable per-session: /delegate-on   Disable: /delegate-off   Switch mode: /kimable-mode');
  log('dim', 'Or globally: export KIMABLE_USE_HOOK=1');
}

// ─── kimable shim (so `kimable -p "..."` works without long --agent-file flag) ─

function shimDir() {
  // Pick a sensible PATH location; user can override with --shim-dir
  if (process.platform === 'win32') {
    return path.join(os.homedir(), '.local', 'bin');
  }
  return process.env.KIMABLE_SHIM_DIR || path.join(os.homedir(), '.local', 'bin');
}

async function installShim() {
  section('kimable shim');
  const dir = shimDir();
  const isWin = process.platform === 'win32';
  const target = path.join(dir, isWin ? 'kimable.cmd' : 'kimable');
  const yamlPath = path.join(KIMABLE_DIR, 'kimable.yaml');

  const yes = await ask(`Install \`kimable\` shim to ${target}?`, true);
  if (!yes) {
    log('dim', 'Skipped shim. You can still run: kimi --agent-file ' + yamlPath + ' -p "..."');
    return;
  }

  if (flags.dryRun) {
    log('dim', `would write shim to ${target}`);
    return;
  }

  fs.mkdirSync(dir, { recursive: true });

  const bashBody = `#!/usr/bin/env bash\nexec kimi --agent-file "${yamlPath.replace(/\\/g, '/')}" "$@"\n`;
  const cmdBody  = `@echo off\r\nkimi --agent-file "${yamlPath}" %*\r\n`;

  if (isWin) {
    // Windows: install BOTH so the shim works from cmd/PowerShell (.cmd)
    // and from git-bash / WSL (extensionless bash script).
    fs.writeFileSync(target, cmdBody);                      // kimable.cmd
    const bashTarget = path.join(dir, 'kimable');
    fs.writeFileSync(bashTarget, bashBody);
    try { fs.chmodSync(bashTarget, 0o755); } catch (_) {}
    log('ok', `shim → ${target}`);
    log('ok', `shim → ${bashTarget}  (for git-bash / WSL)`);
  } else {
    fs.writeFileSync(target, bashBody);
    fs.chmodSync(target, 0o755);
    log('ok', `shim → ${target}`);
  }

  // Friendly PATH check
  const pathEnv = (process.env.PATH || '').split(path.delimiter);
  const onPath = pathEnv.some((p) => p && path.resolve(p) === path.resolve(dir));
  if (!onPath) {
    log('warn', `${dir} is not on your PATH. Add it to use \`kimable\` directly:`);
    if (isWin) {
      log('dim', `  setx PATH "%PATH%;${dir}"      (then restart your shell)`);
    } else {
      log('dim', `  export PATH="${dir}:$PATH"     (add to ~/.bashrc or ~/.zshrc)`);
    }
  }
}

async function setupClaude() {
  section('Claude Code integration');
  if (!claudeDetected()) {
    log('warn', 'Claude Code not detected (~/.claude not found and `claude` not on PATH).');
    log('dim',  'Skipping. Install Claude Code first, then re-run with --update.');
    return;
  }
  log('ok', 'Claude Code detected');

  console.log(`${C.dim}Recommended path: install as a Claude plugin instead — gets you slash commands too.${C.reset}`);
  console.log(`${C.dim}  claude plugin marketplace add github:mikehenken/kimable${C.reset}`);
  console.log(`${C.dim}  /plugin install kimable-delegate${C.reset}\n`);

  await installClaudeAgents();
  await installClaudeHook();
}

function verify() {
  section('Verify');
  if (flags.dryRun) { log('dim', 'skipped (dry run)'); return true; }

  const required = [
    'kimable.yaml',
    'orchestrator/system.md',
    '.claude-plugin/plugin.json',
    'agents/kimi-delegate.md',
    'agents/kimi-orchestrate.md',
    'subagents',
  ];
  let ok = true;
  for (const rel of required) {
    const p = path.join(KIMABLE_DIR, rel);
    if (fs.existsSync(p)) {
      log('ok', rel);
    } else {
      log('err', `missing: ${rel}`);
      ok = false;
    }
  }
  return ok;
}

function printNextSteps(ok) {
  section('Next steps');
  if (!ok) {
    console.log(`${C.red}Install completed with errors. Fix the missing files above and re-run with --update.${C.reset}\n`);
    return;
  }

  console.log(`${C.green}Kimable is installed at ${KIMABLE_DIR}.${C.reset}\n`);

  console.log(`${C.bold}Try it${C.reset}:`);
  console.log(`     ${C.dim}# in Claude Code${C.reset}`);
  console.log(`     ${C.dim}@kimi-delegate "fix the off-by-one in paginate()"${C.reset}`);
  console.log(`     ${C.dim}@kimi-orchestrate "@plan-file:plans/add-oauth.yaml"${C.reset}\n`);

  console.log(`     ${C.dim}# or from any shell${C.reset}`);
  console.log(`     ${C.dim}kimable --prompt "your task"${C.reset}`);
  console.log(`     ${C.dim}# (shim wraps: kimi --agent-file ${KIMABLE_DIR}/kimable.yaml)${C.reset}\n`);

  console.log(`${C.bold}Plugin install${C.reset} (gets you /delegate, /orchestrate, /kimable-mode):`);
  console.log(`     ${C.dim}claude plugin marketplace add github:mikehenken/kimable${C.reset}`);
  console.log(`     ${C.dim}/plugin install kimable-delegate${C.reset}\n`);

  if (!which('kimi')) {
    console.log(`${C.yellow}Note:${C.reset} kimi CLI not on PATH. Install it before using Kimable:`);
    console.log(`     ${C.dim}curl -fsSL ${KIMI_INSTALL_URL} | bash${C.reset}\n`);
  }
}

// ─── main ──────────────────────────────────────────────────────────────

(async () => {
  if (flags.help) { showHelp(); process.exit(0); }

  console.log(`${C.cyan}${C.bold}Kimable installer${C.reset}${flags.dryRun ? `  ${C.yellow}(dry run)${C.reset}` : ''}`);

  checkPrereqs();
  await installKimiCli();
  await syncRepo();
  const ok = verify();
  if (ok) {
    await installShim();
    await setupClaude();
  }
  printNextSteps(ok);

  process.exit(ok ? 0 : 1);
})().catch((e) => {
  log('err', e.message);
  process.exit(1);
});
