#!/bin/bash
RADARDIR=/srv/www/radar/bin
LOGDIR=/srv/www/radar/logs
cd $RADARDIR
forever start -l $LOGDIR/forever.log -o $LOGDIR/main.log -e $LOGDIR/main.err.log -a index.js
#forever start -l $LOGDIR/forever.log -o $LOGDIR/legacy.log -e $LOGDIR/legacy.err.log -a legacylistener.js
