#!/bin/bash
cd /home/kavia/workspace/code-generation/modern-video-editor-207906-207916/video_editing_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

