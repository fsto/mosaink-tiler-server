#!/bin/bash

# Repackage lambda function
jsName=$(ls *.js | tail -n1)
name=${jsName%.js}
if [ -f "$name.zip" ]; then
  rm "$name.zip"
fi
zip -r "$name.zip" . -x \.* *.sh *.zip


aws lambda create-function \
  --region eu-west-1 \
  --function-name $name \
  --zip-file "$name.zip" \
  --role role-arn \
  --handler "$name.handler" \
  --runtime nodejs \
  --profile adminuser \
  --timeout 10 \
  --memory-size 32

