#!/bin/bash
echo "?? Loyiha yangilanmoqda..."
git pull origin main
npm install
npm run build
pm2 restart telegram_casso
echo "? Yangilanish tugadi!"