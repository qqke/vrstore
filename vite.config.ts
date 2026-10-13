import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: process.env.PAGES_BASE || '/',
  optimizeDeps: { include: ['react', 'react-dom/client', 'lucide-react', '@supabase/supabase-js', '@react-three/fiber', '@react-three/drei'] },
  build: { chunkSizeWarningLimit: 1100 },
});
