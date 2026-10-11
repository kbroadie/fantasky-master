// The pull request this page came in with: set in every PR (CLAUDE.md), so Moss's Revision card can say whether a newer
// one is live (the latest "Merge pull request #N" on main, asked of GitHub once a visit)
export const PR = 163;
let latest = null;
export const latestPR = () => (latest ??= fetch("https://api.github.com/repos/kbroadie/fantasky-master/commits?sha=main&per_page=30")
  .then((r) => (r.ok ? r.json() : []))
  .then((cs) => { for (const c of cs) { const m = /^Merge pull request #(\d+)/.exec(c.commit?.message ?? ""); if (m) return +m[1]; } return null; })
  .catch(() => null));
// What the card says: this page against the latest
export const revSay = (n) => (n == null ? "Couldn't check" : n > PR ? `#${n} is live` : "Latest");
// The card's Reload: GitHub Pages lets browsers keep its files for ten minutes, so a plain reload can bring the old
// scripts and styles back. Fetch the page and everything it loaded from here past the cache first, then reload
export async function reloadFresh() {
  const here = (u) => u.startsWith(location.origin) && /\.(js|css|html)(\?|$)/.test(u);
  const urls = new Set([location.href.split("#")[0], ...performance.getEntriesByType("resource").map((e) => e.name).filter(here)]);
  await Promise.allSettled([...urls].map((u) => fetch(u, { cache: "reload" })));
  location.reload();
}
