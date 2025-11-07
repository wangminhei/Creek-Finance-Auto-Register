@echo off
title Creek Finance
color 0A

cd %~dp0

echo Configuration files checked.

echo Checking dependencies...
if exist "..\node_modules" (
    echo Using node_modules from parent directory...
    cd ..
    CALL npm install axios bech32 @mysten/sui https-proxy-agent
    cd %~dp0
) else (
    echo Installing dependencies in current directory...
    CALL npm install axios bech32 @mysten/sui https-proxy-agent
)
echo Dependencies installation completed!
title Creek Finance
echo Starting the bot...
node index.js

pause
exit
