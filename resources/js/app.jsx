import { createInertiaApp } from '@inertiajs/react';
import { createRoot } from 'react-dom/client';
import { initTheme } from '@/lib/theme';

initTheme();

createInertiaApp({
    title: (title) => title ? `${title} — www.doc` : 'www.doc',
    resolve: (name) => {
        const pages = import.meta.glob('./Pages/**/*.jsx', { eager: true });
        return pages[`./Pages/${name}.jsx`];
    },
    setup({ el, App, props }) {
        createRoot(el).render(<App {...props} />);
    },
    progress: {
        // Sage primary (--sage-400) so the loading bar matches the palette
        color: '#7E9D72',
    },
});
