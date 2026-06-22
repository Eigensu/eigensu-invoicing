import type { Config } from 'tailwindcss'
import preset from '@eigensu/config/tailwind'
import animate from 'tailwindcss-animate'

const config: Config = {
  presets: [preset],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  plugins: [animate],
}

export default config
