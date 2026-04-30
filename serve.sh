#!/usr/bin/env bash
cd ~/mathforge
echo "MathForge running at http://localhost:8080"
python3 -m http.server 8080
