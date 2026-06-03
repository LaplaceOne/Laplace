// The exact inline <head> script apps embed before the bundle to avoid theme FOUC.
export const THEME_BOOTSTRAP = `try{var t=localStorage.getItem('laplace-theme')||'light';document.documentElement.setAttribute('data-theme',t);}catch(e){}`;
