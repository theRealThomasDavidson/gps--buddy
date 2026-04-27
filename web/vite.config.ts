import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  // Default Node/Vite can listen on IPv6 only (::1). localhost works; 127.0.0.1 and adb reverse do not.
  server: { host: true },
})
