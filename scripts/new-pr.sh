#!/bin/bash
# Usage: ./scripts/new-pr.sh feature/my-feature "PR title" "PR body"
BRANCH=$1
TITLE=$2
BODY=${3:-"See branch for changes"}

git checkout main && git pull origin main
git checkout -b "$BRANCH"
echo "✅ Branch '$BRANCH' created. Make your changes, then run:"
echo "   git add . && git commit -m 'feat: ...' && git push -u origin HEAD"
echo "   gh pr create --title \"$TITLE\" --body \"$BODY\" --base main"
echo "   gh pr merge --squash --delete-branch"
