/**
 * Sets data-theme on <html> before first paint so the portal renders in the
 * user's chosen theme with no flash. Rendered in the root layout <head> but
 * self-scoped: only /portal routes get a theme attribute — admin dashboard,
 * /payment and /widget stay on the :root (light) tokens.
 */
const THEME_SCRIPT = `(function(){try{if(!location.pathname.startsWith('/portal'))return;var t=localStorage.getItem('replai-theme');if(t!=='light'&&t!=='dark')t='dark';document.documentElement.dataset.theme=t;}catch(e){}})()`

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
}
