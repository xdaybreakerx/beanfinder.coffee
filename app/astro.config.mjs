import { defineConfig } from 'astro/config';
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";
import react from "@astrojs/react";
import netlify from "@astrojs/netlify";

// Determine if we're in a production environment
const isProduction = process.env.NODE_ENV === 'production';

// Use different site URLs based on the environment
const siteUrl = isProduction ? 'https://www.beanfinder.coffee' // Production site URL
: process.env.DEV_SITE_URL || 'http://localhost:4321'; // Local development URL


// https://astro.build/config
export default defineConfig({
  site: siteUrl,
  // Use the dynamically selected site URL
  integrations: [sitemap(), react()],
  vite: {
    plugins: [tailwindcss()],
  },
  output: "server",
  adapter: netlify({
    // This app uses serverless rendering and has no edge functions to emulate.
    devFeatures: { edgeFunctions: false },
  })
});
