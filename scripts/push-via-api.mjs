import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const owner = 'MagneticDogSon';
const repo = 'qlm-telegram';
const branch = 'main';
const root = path.resolve(import.meta.dirname, '..');
const token = process.env.GH_TOKEN;
if (!token) { console.error('GH_TOKEN missing'); process.exit(1); }
const skip = new Set(['.git', 'node_modules', 'data', 'dist', '.env']);

async function api(method, pathname, body) {
  const res = await fetch(`https://api.github.com${pathname}`, {
    method,
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'qlm-telegram-seed', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`${method} ${pathname} ${res.status}: ${data.message || text}`);
  return data;
}
function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (skip.has(name)) continue;
    const full = path.join(dir, name);
    const rel = path.relative(root, full).replaceAll('\\', '/');
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, out); else out.push({ rel, full });
  }
  return out;
}
const files = walk(root);
const ref = await api('GET', `/repos/${owner}/${repo}/git/ref/heads/${branch}`);
const parentCommit = await api('GET', `/repos/${owner}/${repo}/git/commits/${ref.object.sha}`);
const tree = [];
for (const file of files) {
  const buf = fs.readFileSync(file.full);
  const blob = await api('POST', `/repos/${owner}/${repo}/git/blobs`, { content: buf.toString('base64'), encoding: 'base64' });
  tree.push({ path: file.rel, mode: '100644', type: 'blob', sha: blob.sha });
  process.stdout.write('.');
}
const createdTree = await api('POST', `/repos/${owner}/${repo}/git/trees`, { base_tree: parentCommit.tree.sha, tree });
const commit = await api('POST', `/repos/${owner}/${repo}/git/commits`, { message: 'Tighten suggested questions cap to 20vh (total ~24% of screen)', tree: createdTree.sha, parents: [ref.object.sha] });
await api('PATCH', `/repos/${owner}/${repo}/git/refs/heads/${branch}`, { sha: commit.sha });
console.log('pushed', commit.sha);
