#!/bin/bash
if [ -z "$LOOPWORMS_API_KEY" ]
  then
    echo "Missing LOOPWORMS_API_KEY environment variable"
    exit 1
fi

if [ -z "$LOOPWORMS_LOOPERLANDS_BASE_URL" ]
  then
    echo "Missing LOOPWORMS_LOOPERLANDS_BASE_URL environment variable"
    exit 1
fi

#cd tools/maps
#./export.py server && ./export.py client
#cd ../..
docker build . -t blah && docker run -e LOOPWORMS_API_KEY=$LOOPWORMS_API_KEY -e LOOPWORMS_LOOPERLANDS_BASE_URL=$LOOPWORMS_LOOPERLANDS_BASE_URL -e DISCORD_TOKEN=$DISCORD_TOKEN -e LOOPERLANDS_BACKEND_BASE_URL=$LOOPERLANDS_BACKEND_BASE_URL -e LOOPERLANDS_BACKEND_API_KEY=$LOOPERLANDS_BACKEND_API_KEY -t -i -p 8000:8000 -t blah
