import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
const chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export default defineConfig({
 testDir:'./tests',testMatch:'**/*.spec.js',fullyParallel:true,workers:2,timeout:30000,
 use:{baseURL:'http://127.0.0.1:4173',headless:true,launchOptions:existsSync(chrome)?{executablePath:chrome}:{},viewport:{width:1440,height:1000},screenshot:'only-on-failure'},
 webServer:{command:'npm run dev',url:'http://127.0.0.1:4173',reuseExistingServer:true},
 reporter:'list'
});
