export const ssr = false;
export const prerender = false;

import type { PageLoad } from "./$types";

export const load: PageLoad = async () => {
  // Client-only; load handled in component via client helper
  return {};
};
