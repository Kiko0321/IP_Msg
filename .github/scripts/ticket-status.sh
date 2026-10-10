#!/usr/bin/env bash
# Sets the kanban "Status" of the issue for a ticket branch.
#
# Usage: ticket-status.sh <branch> <status-name>
# Env:
#   GH_TOKEN           token with project read/write (PROJECT_TOKEN secret)
#   HAS_PROJECT_TOKEN  "false" to only resolve the issue and skip the board
#   REPO             owner/name of the repository
#   PROJECT_OWNER    login that owns the project (user or org)
#   PROJECT_NUMBER   project number from its URL (.../projects/<number>)
#
# The ticket is found from the branch name (feat/msg-05-foo -> issue titled "MSG-05: ...").
# Prints the issue number on stdout so callers can reuse it.
set -euo pipefail

branch="$1"
status="$2"

if [[ ! "$branch" =~ msg-([0-9]+) ]]; then
  echo "::notice::Branch '$branch' is not a ticket branch; nothing to update." >&2
  exit 0
fi
ticket=$(printf 'MSG-%02d' "$((10#${BASH_REMATCH[1]}))")

issue=$(gh issue list --repo "$REPO" --state all --search "\"$ticket:\" in:title" --json number,title \
  --jq "map(select(.title | startswith(\"$ticket:\"))) | first | .number // empty")
if [[ -z "$issue" ]]; then
  echo "::warning::No issue titled '$ticket: ...' found." >&2
  exit 0
fi
echo "$issue"

if [[ "${HAS_PROJECT_TOKEN:-true}" != "true" ]]; then
  echo "::warning::PROJECT_TOKEN secret is not set; skipping the board update." >&2
  exit 0
fi
if [[ -z "${PROJECT_NUMBER:-}" ]]; then
  echo "::warning::PROJECT_NUMBER variable is not set; skipping the board update." >&2
  exit 0
fi

owner="${REPO%%/*}"
name="${REPO#*/}"

# Project, its Status field, and the issue's existing card on that project.
data=$(gh api graphql \
  -f owner="$owner" -f name="$name" -F number="$issue" \
  -f projectOwner="$PROJECT_OWNER" -F projectNumber="$PROJECT_NUMBER" \
  -f query='
    query($owner: String!, $name: String!, $number: Int!, $projectOwner: String!, $projectNumber: Int!) {
      repositoryOwner(login: $projectOwner) {
        ... on ProjectV2Owner {
          projectV2(number: $projectNumber) {
            id
            field(name: "Status") {
              ... on ProjectV2SingleSelectField { id options { id name } }
            }
          }
        }
      }
      repository(owner: $owner, name: $name) {
        issue(number: $number) {
          id
          projectItems(first: 50) { nodes { id project { id } } }
        }
      }
    }')

project_id=$(jq -r '.data.repositoryOwner.projectV2.id' <<<"$data")
field_id=$(jq -r '.data.repositoryOwner.projectV2.field.id' <<<"$data")
option_id=$(jq -r --arg s "$status" \
  '.data.repositoryOwner.projectV2.field.options[] | select((.name | ascii_downcase) == ($s | ascii_downcase)) | .id' <<<"$data")
issue_id=$(jq -r '.data.repository.issue.id' <<<"$data")
item_id=$(jq -r --arg p "$project_id" \
  '.data.repository.issue.projectItems.nodes[] | select(.project.id == $p) | .id' <<<"$data")

if [[ -z "$option_id" ]]; then
  echo "::warning::Status option '$status' does not exist on the board; skipping." >&2
  exit 0
fi

if [[ -z "$item_id" ]]; then
  item_id=$(gh api graphql -f project="$project_id" -f content="$issue_id" -f query='
    mutation($project: ID!, $content: ID!) {
      addProjectV2ItemById(input: { projectId: $project, contentId: $content }) { item { id } }
    }' --jq '.data.addProjectV2ItemById.item.id')
fi

gh api graphql -f project="$project_id" -f item="$item_id" -f field="$field_id" -f option="$option_id" -f query='
  mutation($project: ID!, $item: ID!, $field: ID!, $option: String!) {
    updateProjectV2ItemFieldValue(input: {
      projectId: $project, itemId: $item, fieldId: $field, value: { singleSelectOptionId: $option }
    }) { projectV2Item { id } }
  }' >/dev/null

echo "::notice::$ticket (#$issue) -> $status" >&2
