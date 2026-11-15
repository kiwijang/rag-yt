import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import sax from 'sax';

const baseUrl = 'https://raw.githubusercontent.com/lucide-icons/lucide/main';
const destination = new URL('../libs/shared/ui/src/assets/icons/', import.meta.url);
const icons = [
  'search', 'plus', 'x', 'check', 'trash-2', 'pencil', 'download', 'filter',
  'chevron-down', 'chevron-right', 'chevron-left', 'loader-2', 'alert-circle',
  'info', 'settings', 'user',
];
// Map local filenames to the canonical names in the Lucide icon directory.
const canonicalNames = {
  'trash-2': 'trash',
  filter: 'funnel',
  'loader-2': 'loader-circle',
  'alert-circle': 'circle-exclamation-point',
};

function download(path) {
  const url = baseUrl + '/' + path;
  const result = spawnSync(process.platform === 'win32' ? 'curl.exe' : 'curl', [
    '--silent', '--show-error', '--location', '--connect-timeout', '8',
    '--max-time', '30', '--write-out', '\n%{http_code}', url,
  ]);
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(result.stderr.toString().trim() || `curl failed for ${url}.`);
  }
  const response = result.stdout;
  const separator = response.lastIndexOf(10);
  const status = response.subarray(separator + 1).toString();
  if (status === '404') return null;
  if (status !== '200') throw new Error(`GitHub returned HTTP ${status} for ${url}.`);
  return response.subarray(0, separator);
}

function verifySvg(name, bytes) {
  const parser = sax.parser(true, { xmlns: true });
  let root;
  parser.onopentag = tag => { root ??= tag; };
  parser.ondoctype = () => { throw new Error(`Unexpected doctype in ${name}.`); };
  parser.write(bytes.toString('utf8')).close();
  if (root?.local !== 'svg' || root.uri !== 'http://www.w3.org/2000/svg') {
    throw new Error(`Expected an SVG document for ${name}.`);
  }
}

async function main() {
  const files = new Map();
  for (const icon of icons) {
    const name = canonicalNames[icon] ?? icon;
    const path = `icons/${name}.svg`;
    const bytes = download(path);
    if (!bytes) throw new Error(`GitHub returned HTTP 404 for ${baseUrl}/${path} (local file: ${icon}.svg).`);
    verifySvg(icon, bytes);
    files.set(`${icon}.svg`, bytes);
  }

  const license = download('LICENSE');
  if (!license?.toString().trim()) throw new Error('Lucide license could not be downloaded.');
  files.set('LICENSE', license);

  await mkdir(destination, { recursive: true });
  for (const [name, bytes] of files) {
    await writeFile(new URL(name, destination), bytes);
  }
  console.log(`Downloaded and verified ${icons.length} Lucide SVG files.`);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
