import { pathToFileURL } from 'node:url';

// PostgreSQL POSIX alnum does not include Unicode marks. Generate the missing
// category from the project's declared Node/Unicode version, without an extension.
export function cityUnicodeMarkPattern() {
  const ranges = [];
  let start = null;
  const escape = point => point <= 0xffff ? `\\${point.toString(16).padStart(4, '0')}` : `\\+${point.toString(16).padStart(6, '0')}`;
  const append = end => { ranges.push(escape(start) + (end === start ? '' : '-' + escape(end))); start = null; };
  for (let point = 0; point <= 0x10ffff; point++) {
    const mark = /\p{M}/u.test(String.fromCodePoint(point));
    if (mark && start === null) start = point;
    if (!mark && start !== null) append(point - 1);
  }
  if (start !== null) append(0x10ffff);
  return { unicode: process.versions.unicode, node: process.version, ranges: ranges.length, sql: `U&'[${ranges.join('')}]'` };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.stdout.write(JSON.stringify(cityUnicodeMarkPattern(), null, 2) + '\n');
}
