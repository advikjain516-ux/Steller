#!/bin/bash
# ==============================================================================
# Library Management System - Startup Script
# ==============================================================================

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

# Determine python command
if command -v python3 &>/dev/null; then
    PY_CMD="python3"
elif [ -f "/Library/Frameworks/Python.framework/Versions/3.11/bin/python3" ]; then
    PY_CMD="/Library/Frameworks/Python.framework/Versions/3.11/bin/python3"
else
    PY_CMD="python"
fi

echo "================================================================="
echo " Starting Library Management System..."
echo " Python: $($PY_CMD --version)"
echo " Project Directory: $DIR"
echo "================================================================="

# Start backend server
$PY_CMD server.py
