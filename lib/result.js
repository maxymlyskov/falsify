'use strict';
// Every gate prints exactly one `<NAME>_RESULT {json}` line last and exits by the contract:
//   0 when pass is true or null (null = could not measure; the scorecard treats it as [—] with `code`)
//   1 when pass is false
//   2 when ok is false (the gate itself could not run: bad args, missing tool)

const started = Date.now();

function emit(name, result) {
  const out = { ok: true, ...result, ms: Date.now() - started };
  process.stdout.write(`${name}_RESULT ${JSON.stringify(out)}\n`);
  if (out.ok === false) process.exit(2);
  process.exit(out.pass === false ? 1 : 0);
}

function usage(name, message) {
  emit(name, { ok: false, pass: null, code: 'BAD_ARGS', message });
}

// Minimal argv parser: positionals + --flag value | --flag=value | --flag (boolean). Repeated flags collect.
function parseArgs(argv, { booleans = [], multi = [] } = {}) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { positional.push(a); continue; }
    let [key, val] = a.slice(2).split(/=(.*)/s);
    if (val === undefined) {
      if (booleans.includes(key)) val = true;
      else val = argv[++i];
    }
    if (multi.includes(key)) (flags[key] = flags[key] || []).push(val);
    else flags[key] = val;
  }
  return { positional, flags };
}

module.exports = { emit, usage, parseArgs };
