#!/bin/bash
#
# Copyright 2026 Google LLC
#
# Setup script to configure and verify Application Default Credentials (ADC)
# and Google Cloud Model API (Gemini) access on Linux CLI and macOS.
#

set -euo pipefail

# Configuration
DEFAULT_GEMINI_MODEL="gemini-3.8-flash"
readonly DEFAULT_GEMINI_MODEL

echo "================================================================"
echo "   Google Cloud Model API & Gemini: ADC Setup Script"
echo "================================================================"

# --- Pre-flight Checks ---
if ! command -v curl >/dev/null 2>&1; then
  echo "❌ 'curl' is required to run this script. Please install curl and retry."
  exit 1
fi

# --- Step 1: Locate or Install gcloud CLI ---
echo ""
echo "--- Step 1: Locating gcloud CLI ---"

GCLOUD_NEWLY_INSTALLED=false
GCLOUD_BIN=""

if command -v gcloud >/dev/null 2>&1; then
  GCLOUD_BIN="$(command -v gcloud)"
  echo "✅ gcloud CLI detected via PATH at: $GCLOUD_BIN"
elif [[ -x "$HOME/google-cloud-sdk/bin/gcloud" ]]; then
  GCLOUD_BIN="$HOME/google-cloud-sdk/bin/gcloud"
  echo "✅ gcloud CLI detected at: $GCLOUD_BIN"
else
  echo "⬇️  gcloud CLI not found. Downloading Google Cloud SDK installer..."
  TMP_INSTALL="$(mktemp "${TMPDIR:-/tmp}/gcloud_install.XXXXXX")"
  trap 'rm -f "$TMP_INSTALL"' EXIT

  if ! curl -sSL https://sdk.cloud.google.com -o "$TMP_INSTALL"; then
    echo "❌ Failed to download Google Cloud SDK installer."
    exit 1
  fi

  bash "$TMP_INSTALL" --disable-prompts --install-dir="$HOME" || true
  rm -f "$TMP_INSTALL"
  trap - EXIT

  if [[ -x "$HOME/google-cloud-sdk/bin/gcloud" ]]; then
    GCLOUD_BIN="$HOME/google-cloud-sdk/bin/gcloud"
    GCLOUD_NEWLY_INSTALLED=true
    PATH="$HOME/google-cloud-sdk/bin:$PATH"
    export PATH
    echo "✅ gcloud CLI installed at: $GCLOUD_BIN"
  else
    echo "❌ Critical Error: gcloud failed to install."
    exit 1
  fi
fi

# Ensure gcloud directory is in PATH for this script execution
if [[ -n "$GCLOUD_BIN" && -d "$(dirname "$GCLOUD_BIN")" ]]; then
  GCLOUD_DIR="$(dirname "$GCLOUD_BIN")"
  PATH="$GCLOUD_DIR:$PATH"
  export PATH
fi

# --- Step 2: Project Configuration ---
echo ""
echo "--- Step 2: Project Setup ---"
echo "Enter your Google Cloud Project ID (NOT the project name)."
read -r -p "Project ID: " PROJECT_ID

# Strip accidental whitespace and quotes from copy-pasting
PROJECT_ID="$(echo "$PROJECT_ID" | tr -d '\"'\'' ')"

if [[ -z "$PROJECT_ID" ]]; then
  echo "❌ Project ID cannot be empty."
  exit 1
fi

# --- Step 3: Authenticate Application Default Credentials (ADC) ---
echo ""
echo "--- Step 3: Authenticating Application Default Credentials (ADC) ---"
echo "Authorizing your Google Cloud account for Application Default Credentials..."

# Detect if running in a headless / remote SSH environment without GUI browser support
is_headless() {
  if [[ -n "${SSH_CLIENT:-}" || -n "${SSH_TTY:-}" || -n "${SSH_CONNECTION:-}" ]]; then
    if [[ -z "${DISPLAY:-}" ]]; then
      return 0
    fi
  fi

  if [[ "$(uname -s)" == "Darwin" ]]; then
    return 1
  fi

  if [[ -z "${DISPLAY:-}" && -z "${WAYLAND_DISPLAY:-}" ]]; then
    return 0
  fi

  return 1
}

if is_headless; then
  echo "ℹ️  Headless/remote environment detected. Launching login in no-browser mode..."
  "$GCLOUD_BIN" auth application-default login --no-launch-browser
else
  "$GCLOUD_BIN" auth application-default login
fi

# --- Step 4: Finalizing Project & Quota Configuration ---
echo ""
echo "--- Step 4: Finalizing Project & Quota Configuration ---"
"$GCLOUD_BIN" config set project "$PROJECT_ID"
"$GCLOUD_BIN" auth application-default set-quota-project "$PROJECT_ID"

# --- Step 5: Check & Enable Required APIs ---
echo ""
echo "--- Step 5: Ensuring Agent Platform / Model API is Enabled ---"
echo "🔌 Checking if Google Cloud Model API (aiplatform.googleapis.com) is enabled..."

ACCESS_TOKEN=$("$GCLOUD_BIN" auth application-default print-access-token 2>/dev/null || true)

if [[ -z "$ACCESS_TOKEN" ]]; then
  echo "❌ Authentication failed. Could not retrieve token from Application Default Credentials."
  echo "   Verify credentials exist at: ~/.config/gcloud/application_default_credentials.json"
  exit 1
fi

CHECK_RESP=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "X-Goog-User-Project: $PROJECT_ID" \
  "https://serviceusage.googleapis.com/v1/projects/$PROJECT_ID/services/aiplatform.googleapis.com" || true)

CHECK_BODY=$(echo "$CHECK_RESP" | sed -e '$d')
CHECK_STATUS=$(echo "$CHECK_RESP" | tail -n 1 | sed -e 's/HTTP_STATUS://')

if [[ "$CHECK_STATUS" == "200" ]] && echo "$CHECK_BODY" | grep -iq '"state":\s*"ENABLED"'; then
  echo "✅ 'aiplatform.googleapis.com' is already enabled on project '$PROJECT_ID'."
else
  echo "🔌 'aiplatform.googleapis.com' is not enabled. Enabling API..."
  ENABLE_RESP=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "X-Goog-User-Project: $PROJECT_ID" \
    -H "Content-Type: application/json" \
    "https://serviceusage.googleapis.com/v1/projects/$PROJECT_ID/services/aiplatform.googleapis.com:enable" \
    -d "{}" || true)

  ENABLE_STATUS=$(echo "$ENABLE_RESP" | tail -n 1 | sed -e 's/HTTP_STATUS://')

  if [[ "$ENABLE_STATUS" == "200" ]]; then
    echo "⏳ Enabling 'aiplatform.googleapis.com'... verifying activation..."
    MAX_POLL=5
    POLL_COUNT=0
    IS_ENABLED=false

    while [[ $POLL_COUNT -lt $MAX_POLL ]]; do
      sleep 3
      POLL_BODY=$(curl -s \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -H "X-Goog-User-Project: $PROJECT_ID" \
        "https://serviceusage.googleapis.com/v1/projects/$PROJECT_ID/services/aiplatform.googleapis.com" || true)

      if echo "$POLL_BODY" | grep -iq '"state":\s*"ENABLED"'; then
        IS_ENABLED=true
        echo "✅ 'aiplatform.googleapis.com' is now enabled and active on project '$PROJECT_ID'."
        break
      fi
      POLL_COUNT=$((POLL_COUNT + 1))
    done

    if [[ "$IS_ENABLED" != "true" ]]; then
      echo "⚠️  Enablement was requested, but activation confirmation timed out."
      echo "   Continuing to Step 6 to verify Application Default Credentials (ADC)..."
    fi
  else
    echo "⚠️  Could not automatically enable the API via Service Usage API (HTTP $ENABLE_STATUS)."
    echo "   Enabling APIs requires Service Usage Admin or Project Owner permissions."
    echo "   Continuing to Step 6 to verify Application Default Credentials (ADC), as the API may already be managed or enabled out-of-band..."
  fi
fi

# --- Step 6: Verify ADC Access & Gemini API ---
echo ""
echo "--- Step 6: Verifying ADC Access & Gemini API ---"
echo "✅ Application Default Credentials (ADC) successfully configured!"
echo "📁 Credentials location: $HOME/.config/gcloud/application_default_credentials.json"
echo "🏷️  Quota Project: $PROJECT_ID"
echo ""

# Discover latest active Gemini Flash model dynamically with fallback to default
GEMINI_MODEL="$DEFAULT_GEMINI_MODEL"
MODELS_JSON=$(curl -s \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "X-Goog-User-Project: $PROJECT_ID" \
  "https://aiplatform.googleapis.com/v1beta1/publishers/google/models?pageSize=100" || true)

DISCOVERED_MODEL=$(echo "$MODELS_JSON" \
  | grep -o '"name":\s*"publishers/google/models/gemini-[^"]*"' \
  | sed 's/.*models\///; s/"//' \
  | grep -E '^gemini-[0-9]+(\.[0-9]+)?-flash$' \
  | sort -V \
  | tail -n 1 || true)

if [[ -n "$DISCOVERED_MODEL" ]]; then
  GEMINI_MODEL="$DISCOVERED_MODEL"
fi

echo "📡 Sending test request to Gemini Model API ($GEMINI_MODEL)..."

ENDPOINT="https://aiplatform.googleapis.com/v1/projects/$PROJECT_ID/locations/global/publishers/google/models/$GEMINI_MODEL:generateContent"
PAYLOAD='{ "contents": [{ "role": "user", "parts": [{ "text": "Reply ONLY with the word SUCCESS" }] }] }'

HTTP_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "X-Goog-User-Project: $PROJECT_ID" \
  -H "Content-Type: application/json" \
  "$ENDPOINT" \
  -d "$PAYLOAD" || true)

HTTP_BODY=$(echo "$HTTP_RESPONSE" | sed -e '$d')
HTTP_STATUS=$(echo "$HTTP_RESPONSE" | tail -n 1 | sed -e 's/HTTP_STATUS://')

if echo "$HTTP_BODY" | grep -iq "SUCCESS"; then
  echo ""
  echo "🎉 SUCCESS! Your Application Default Credentials and Model API access are fully working."
  echo "📁 ADC Credentials location: $HOME/.config/gcloud/application_default_credentials.json"
  echo "🏷️  Quota Project: $PROJECT_ID"
else
  echo ""
  echo "ℹ️  ADC credentials are saved and ready, but the test call to the Model API was not successful (HTTP $HTTP_STATUS)."
  echo "📁 ADC Credentials location: $HOME/.config/gcloud/application_default_credentials.json"
  echo "🏷️  Quota Project: $PROJECT_ID"
  echo "   This is non-fatal for ADC setup, but indicates your project or account settings may need adjustment."
  echo ""
  echo "Troubleshooting Tips:"
  echo " 1. Ensure 'aiplatform.googleapis.com' is enabled for project '$PROJECT_ID'."
  echo " 2. Ensure your account has the 'Vertex AI User' role (roles/aiplatform.user) or Agent Platform permissions on the project."
  echo " 3. Verify that Cloud Billing is active for project '$PROJECT_ID'."
  echo " 4. Enterprise / Domain Policies: Organizations with Context-Aware Access (CAA) or device certificate mTLS enforcement may restrict direct REST calls with these tokens, but your ADC credentials will function normally with Google Cloud SDKs and Client Libraries."
  echo " 5. Check Agent Platform in Cloud Console: https://console.cloud.google.com/gen-app-builder?project=$PROJECT_ID"
fi

if [[ "$GCLOUD_NEWLY_INSTALLED" == "true" ]]; then
  echo ""
  echo "💡 Tip: Google Cloud SDK was newly installed."
  if [[ "${SHELL:-}" == *"zsh"* ]]; then
    echo "   To use 'gcloud' immediately in this terminal, run: source ~/.zshrc"
    echo "   (or open a new terminal window to apply changes automatically)."
  else
    echo "   To use 'gcloud' immediately in this terminal, run: source ~/.bashrc"
    echo "   (or open a new terminal window to apply changes automatically)."
  fi
fi

echo ""
echo "💡 Note on gcloud CLI Usage:"
echo " • ADC is ready for code, Client Libraries, and Gemini API calls."
echo " • To also run 'gcloud' CLI commands (e.g. gcloud storage, gcloud compute), log in to the CLI tool by running:"
echo "   gcloud auth login"

echo ""
echo "📖 Documentation & Quickstarts:"
echo " • ADC Guide: https://cloud.google.com/docs/authentication/application-default-credentials"
echo " • Gemini & Agent Platform Quickstarts: https://cloud.google.com/vertex-ai/docs/generative-ai/learn/overview"