try {
  var savedTheme = localStorage.getItem('bayan_app_theme_v1');
  if (
    savedTheme === 'light' ||
    (!savedTheme && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches)
  ) {
    document.documentElement.classList.remove('dark');
  }
} catch (e) {}
