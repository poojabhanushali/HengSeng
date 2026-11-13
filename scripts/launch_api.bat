@echo off
cd /d D:\HengSeng
node_modules\.bin\tsx scripts/start_api_only.ts > D:\HengSeng\scripts/api.out 2> D:\HengSeng\scripts/api.err
