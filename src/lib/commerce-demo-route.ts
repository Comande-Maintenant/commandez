/** Local simulations must not become merchant activity in production analytics. */
export function isLocalCommerceDemoPath(pathname: string): boolean {
  try {
    const path = decodeURIComponent(pathname).toLowerCase().replace(/\/+$/, '');
    return ['/decouvrir', '/demo/epicerie', '/demo/fleuriste'].includes(path);
  } catch {
    return false;
  }
}
