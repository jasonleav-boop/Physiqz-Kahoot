@echo off
title Upload to GitHub - PhysiKahoot
cls
echo ============================================================
echo   PHYSICAL KAHOOT - AUTOMATIC GITHUB UPLOADER
echo ============================================================
echo.
echo Connecting to your repository:
echo https://github.com/jasonleav-boop/Physiqz-Kahoot
echo.
echo If a browser window pops up asking you to sign in,
echo please click "Sign in with your browser" or "Authorize".
echo.
echo Uploading files now, please wait a few seconds...
echo ------------------------------------------------------------
echo.

git push -u origin main

echo.
echo ------------------------------------------------------------
echo All files have been uploaded!
echo You can now go to: https://github.com/jasonleav-boop/Physiqz-Kahoot
echo and refresh the page to see your project online.
echo ------------------------------------------------------------
echo.
pause
