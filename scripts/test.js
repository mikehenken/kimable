#!/usr/bin/env node

/**
 * Kimable Pipeline Test
 * 
 * Run: npx kimable-test
 * Or:  node scripts/test.js
 * 
 * This script exercises the full pipeline and shows verbose output.
 * It checks prerequisites, loads configs, simulates or runs delegation,
 * and displays logs from every step.
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for output
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(label, msg, color = C.reset) {
  console.log(`${color}${C.bold}[${label}]${C.reset} ${msg}`);
}

function section(title) {
  console.log('');
  console.log(`${C.cyan}${C.bold}═══ ${title} ═══${C.reset}`);
  console.log('');
}

function cmdOutput(label, output) {
  const lines = output.trim().split('\n');
  lines.forEach((line, i) => {
    const prefix = i === 0 ? `${C.dim}[${label}]${C.reset} ` : '           ';
    console.log(`${prefix}${line}`);
  });
}

let exitCode = 0;
let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  try {
    fn();
    testsPassed++;
    log('PASS', name, C.green);
  } catch (e) {
    testsFailed++;
    exitCode = 1;
    log('FAIL', `${name}: ${e.message}`, C.red);
  }
}

section('Kimable Pipeline Test');

const repoRoot = path.resolve(__dirname, '..');
const kimiYaml = path.join(repoRoot, 'kimable.yaml');
const orchestratorMd = path.join(repoRoot, 'orchestrator', 'system.md');
const claudeAgent = path.join(repoRoot, 'claude-integration', 'kimi-delegate.md');
const subagentsDir = path.join(repoRoot, 'subagents');

console.log(`${C.dim}Repository root: ${repoRoot}${C.reset}`);
console.log(`${C.dim}kimable.yaml:    ${kimiYaml}${C.reset}`);
console.log(`${C.dim}Subagents dir:   ${subagentsDir}${C.reset}`);
console.log('');

// ─── CHECK 1: Kimi CLI installed ───
section('Check 1: Kimi CLI Installation');

let kimiVersion = null;
try {
  kimiVersion = execSync('kimi --version', { encoding: 'utf8', timeout: 5000 });
  log('FOUND', 'kimi CLI is installed', C.green);
  cmdOutput('kimi --version', kimiVersion);
} catch (e) {
  log('MISSING', 'kimi CLI not found on PATH', C.yellow);
  console.log(`${C.dim}  Install: curl -L code.kimi.com/install.sh | bash${C.reset}`);
  console.log(`${C.dim}  Or visit: https://www.kimi.com/code${C.reset}`);
}

// ─── CHECK 2: Repository files ───
section('Check 2: Repository Structure');

test('kimable.yaml exists', () => {
  if (!fs.existsSync(kimiYaml)) throw new Error(`${kimiYaml} not found`);
  const stats = fs.statSync(kimiYaml);
  console.log(`  ${C.dim}Size: ${stats.size} bytes${C.reset}`);
});

test('orchestrator/system.md exists', () => {
  if (!fs.existsSync(orchestratorMd)) throw new Error(`${orchestratorMd} not found`);
  const lines = fs.readFileSync(orchestratorMd, 'utf8').split('\n').length;
  console.log(`  ${C.dim}Lines: ${lines}${C.reset}`);
});

test('claude-integration/kimi-delegate.md exists', () => {
  if (!fs.existsSync(claudeAgent)) throw new Error(`${claudeAgent} not found`);
  const size = fs.statSync(claudeAgent).size;
  console.log(`  ${C.dim}Size: ${size} bytes${C.reset}`);
});

// Count subagents
const subagents = fs.readdirSync(subagentsDir).filter(d => {
  const p = path.join(subagentsDir, d);
  return fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, 'agent.yaml'));
});

log('COUNT', `${subagents.length} subagents found in subagents/`, C.blue);
subagents.forEach(name => {
  const yamlPath = path.join(subagentsDir, name, 'agent.yaml');
  const mdPath = path.join(subagentsDir, name, 'system.md');
  const yamlOk = fs.existsSync(yamlPath);
  const mdOk = fs.existsSync(mdPath);
  const status = yamlOk && mdOk ? `${C.green}ok${C.reset}` : `${C.red}missing files${C.reset}`;
  console.log(`  ${C.dim}- ${name}: ${status}${C.reset}`);
});

// ─── CHECK 3: Kimable config load ───
section('Check 3: Kimable Config Load');

if (kimiVersion) {
  try {
    const loadTest = execSync(
      `cd ${repoRoot} && kimi --agent kimable.yaml --prompt "@complexity:low @effort:minimal List the files in the current directory" 2>&1`,
      { encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024 }
    );
    log('LOADED', 'kimable.yaml loaded and executed', C.green);
    cmdOutput('kimi', loadTest.substring(0, 800));
    if (loadTest.length > 800) {
      console.log(`  ${C.dim}... (${loadTest.length - 800} more chars)${C.reset}`);
    }
  } catch (e) {
    log('ERROR', `Config load failed: ${e.message}`, C.red);
    if (e.stdout) cmdOutput('stdout', e.stdout.toString());
    if (e.stderr) cmdOutput('stderr', e.stderr.toString());
  }
} else {
  log('SKIP', 'Kimi CLI not installed, skipping config load test', C.yellow);
}

// ─── CHECK 4: Claude agent installation ───
section('Check 4: Claude Code Integration');

const claudeAgentsDir = path.join(require('os').homedir(), '.claude', 'agents');
const claudeAgentInstalled = path.join(claudeAgentsDir, 'kimi-delegate.md');

test('Claude agents directory exists', () => {
  if (!fs.existsSync(claudeAgentsDir)) {
    throw new Error(`~/.claude/agents/ not found. Run: ./claude-integration/install.sh`);
  }
});

test('kimi-delegate agent installed', () => {
  if (!fs.existsSync(claudeAgentInstalled)) {
    throw new Error(`kimi-delegate.md not in ~/.claude/agents/. Run: cp claude-integration/kimi-delegate.md ~/.claude/agents/`);
  }
  const size = fs.statSync(claudeAgentInstalled).size;
  console.log(`  ${C.dim}Installed size: ${size} bytes${C.reset}`);
});

// Show diff if files differ
if (fs.existsSync(claudeAgent) && fs.existsSync(claudeAgentInstalled)) {
  const source = fs.readFileSync(claudeAgent, 'utf8');
  const installed = fs.readFileSync(claudeAgentInstalled, 'utf8');
  if (source !== installed) {
    log('WARN', 'Installed agent differs from repo version', C.yellow);
    console.log(`  ${C.dim}Run: cp claude-integration/kimi-delegate.md ~/.claude/agents/ to update${C.reset}`);
  } else {
    log('SYNC', 'Installed agent matches repo version', C.green);
  }
}

// ─── CHECK 5: Journal / Logs ───
section('Check 5: Observability');

const journalPath = path.join(repoRoot, 'journal.md');
const logsDir = path.join(repoRoot, '.kimi', 'logs');
const jsonlPath = path.join(logsDir, 'runs.jsonl');

if (fs.existsSync(journalPath)) {
  const lines = fs.readFileSync(journalPath, 'utf8').split('\n').length;
  log('JOURNAL', `journal.md exists (${lines} lines)`, C.blue);
} else {
  log('JOURNAL', 'journal.md not found (will be created on first run)', C.yellow);
}

if (fs.existsSync(jsonlPath)) {
  const lines = fs.readFileSync(jsonlPath, 'utf8').trim().split('\n').length;
  log('JSONL', `.kimi/logs/runs.jsonl exists (${lines} entries)`, C.blue);
  
  // Show last few entries
  const entries = fs.readFileSync(jsonlPath, 'utf8').trim().split('\n').slice(-3);
  console.log(`  ${C.dim}Last 3 entries:${C.reset}`);
  entries.forEach((entry, i) => {
    try {
      const parsed = JSON.parse(entry);
      console.log(`    ${C.dim}${i+1}. ${parsed.type || 'unknown'} | ${parsed.ts || 'no timestamp'}${C.reset}`);
    } catch {
      console.log(`    ${C.dim}${i+1}. (invalid JSON)${C.reset}`);
    }
  });
} else {
  log('JSONL', '.kimi/logs/runs.jsonl not found (will be created on first run)', C.yellow);
}

// ─── CHECK 6: Agent validation ───
section('Check 6: Agent YAML Validation');

const yaml = require('yaml');
let validCount = 0;
let invalidCount = 0;

subagents.forEach(name => {
  const yamlPath = path.join(subagentsDir, name, 'agent.yaml');
  try {
    const content = fs.readFileSync(yamlPath, 'utf8');
    const parsed = yaml.parse(content);
    const required = ['version', 'name', 'description', 'tools'];
    const missing = required.filter(k => !(k in parsed));
    if (missing.length > 0) {
      log('INVALID', `${name}: missing keys [${missing.join(', ')}]`, C.red);
      invalidCount++;
    } else {
      log('VALID', `${name}: ${parsed.name} (${parsed.tools?.length || 0} tools)`, C.green);
      validCount++;
    }
  } catch (e) {
    log('ERROR', `${name}: ${e.message}`, C.red);
    invalidCount++;
  }
});

// ─── CHECK 7: kimable.yaml validation ───
section('Check 7: Orchestrator Manifest');

try {
  const content = fs.readFileSync(kimiYaml, 'utf8');
  const parsed = yaml.parse(content);
  const subagentList = parsed.subagents || [];
  log('MANIFEST', `${subagentList.length} subagents registered`, C.blue);
  
  subagentList.forEach(sa => {
    const exists = fs.existsSync(path.join(repoRoot, sa.path, 'agent.yaml'));
    const status = exists ? `${C.green}ok${C.reset}` : `${C.red}MISSING${C.reset}`;
    console.log(`  ${C.dim}- ${sa.name} → ${sa.path} ${status}${C.reset}`);
  });
  
  const orphanAgents = subagents.filter(name => {
    return !subagentList.some(sa => sa.name === name);
  });
  if (orphanAgents.length > 0) {
    log('ORPHAN', `Subagents not in kimable.yaml: ${orphanAgents.join(', ')}`, C.yellow);
  }
} catch (e) {
  log('ERROR', `Failed to parse kimable.yaml: ${e.message}`, C.red);
}

// ─── SUMMARY ───
section('Summary');

const totalChecks = testsPassed + testsFailed;
console.log(`Total checks:  ${totalChecks}`);
console.log(`Passed:        ${C.green}${testsPassed}${C.reset}`);
console.log(`Failed:        ${testsFailed > 0 ? C.red : C.green}${testsFailed}${C.reset}`);
console.log('');

if (testsFailed === 0) {
  console.log(`${C.green}${C.bold}All checks passed. Kimable is ready.${C.reset}`);
  console.log('');
  console.log(`${C.dim}Next steps:${C.reset}`);
  console.log(`  ${C.dim}1. Run: kimi --agent kimable.yaml --prompt "your task"${C.reset}`);
  console.log(`  ${C.dim}2. Or in Claude Code: @kimi-delegate research this API${C.reset}`);
} else {
  console.log(`${C.yellow}${C.bold}Some checks failed. Fix the issues above.${C.reset}`);
  console.log('');
  console.log(`${C.dim}Common fixes:${C.reset}`);
  console.log(`  ${C.dim}- kimi CLI missing: curl -L code.kimi.com/install.sh | bash${C.reset}`);
  console.log(`  ${C.dim}- Claude agent missing: ./claude-integration/install.sh${C.reset}`);
  console.log(`  ${C.dim}- Missing subagent: check subagents/<name>/agent.yaml exists${C.reset}`);
}

process.exit(exitCode);
