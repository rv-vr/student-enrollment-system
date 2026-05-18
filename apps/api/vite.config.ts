import { cloudflare } from '@cloudflare/vite-plugin'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    cloudflare() // Keeps your Hono code closely emulating the Cloudflare Workers runtime
  ],
  server: {
    port: 8787 // Locks your backend to a predictable port
  }
})