/**
 * Google Drive Sync Service
 * Handles syncing Word Master Challenge data to/from Google Drive
 *
 * Uses Google Identity Services (GIS) for OAuth
 * Stores data in a single JSON file in the app data folder
 */

import { getChildren, getWords, db } from "./storage.js";
import { Child } from "../models/Child.js";
import { Word } from "../models/Word.js";

// Google API configuration
// NOTE: Replace with your actual Google Cloud Project Client ID
const CLIENT_ID =
  "369203764258-bi992i159l7u73sdp84h95rg4qqrjvqo.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/drive.appdata";
const DISCOVERY_DOC =
  "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest";

// File name in Google Drive
const SYNC_FILE_NAME = "wordmaster-data.json";

// Sync state
let accessToken = null;
let gapiInited = false;
let gisInited = false;
let tokenClient = null;

// Callbacks for UI updates
let onSyncStatusChange = null;

/**
 * Initialize Google API client
 */
export async function initGoogleAPI() {
  return new Promise((resolve, reject) => {
    // Load the Google API client
    if (typeof gapi === "undefined") {
      reject(
        new Error(
          "Google API not loaded. Make sure to include the script in index.html"
        )
      );
      return;
    }

    gapi.load("client", async () => {
      try {
        await gapi.client.init({
          apiKey: "", // Not needed for this use case
          discoveryDocs: [DISCOVERY_DOC],
        });
        gapiInited = true;
        console.log("Google API initialized");
        resolve();
      } catch (error) {
        console.error("Error initializing Google API:", error);
        reject(error);
      }
    });
  });
}

/**
 * Initialize Google Identity Services (OAuth)
 */
export function initGoogleIdentity() {
  return new Promise((resolve, reject) => {
    if (typeof google === "undefined" || !google.accounts) {
      reject(new Error("Google Identity Services not loaded"));
      return;
    }

    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: "", // Will be set later
    });

    gisInited = true;
    console.log("Google Identity Services initialized");
    resolve();
  });
}

/**
 * Set callback for sync status changes
 */
export function setSyncStatusCallback(callback) {
  onSyncStatusChange = callback;
}

/**
 * Request access token and sign in
 */
export async function signInToGoogleDrive() {
  return new Promise((resolve, reject) => {
    if (!gisInited || !gapiInited) {
      reject(new Error("Google services not initialized"));
      return;
    }

    // Set callback for token response
    tokenClient.callback = async (response) => {
      if (response.error !== undefined) {
        reject(response);
        return;
      }

      accessToken = response.access_token;
      gapi.client.setToken({ access_token: accessToken });

      console.log("Signed in to Google Drive");
      notifyStatusChange({ connected: true, lastSync: null });
      resolve();
    };

    // Request access token
    if (accessToken === null) {
      // Prompt the user to select a Google Account and ask for consent
      tokenClient.requestAccessToken({ prompt: "consent" });
    } else {
      // Skip display of account chooser and consent dialog for an existing session
      tokenClient.requestAccessToken({ prompt: "" });
    }
  });
}

/**
 * Sign out from Google Drive
 */
export function signOutFromGoogleDrive() {
  if (accessToken) {
    google.accounts.oauth2.revoke(accessToken, () => {
      console.log("Access token revoked");
    });
    accessToken = null;
    gapi.client.setToken(null);
    notifyStatusChange({ connected: false, lastSync: null });
  }
}

/**
 * Check if signed in
 */
export function isSignedIn() {
  return accessToken !== null;
}

/**
 * Export all data from IndexedDB
 */
async function exportAllData() {
  const children = await getChildren();
  const allWords = [];

  for (const child of children) {
    const words = await getWords(child.id);
    allWords.push(...words);
  }

  return {
    version: 1,
    lastSync: new Date().toISOString(),
    children: children.map((c) => c.toJSON()),
    words: allWords.map((w) => w.toJSON()),
  };
}

/**
 * Import data into IndexedDB
 */
async function importAllData(data) {
  if (!data || data.version !== 1) {
    throw new Error("Invalid data format");
  }

  // Clear existing data
  await db.children.clear();
  await db.words.clear();

  // Import children
  const childIdMap = new Map(); // Old ID -> New ID
  for (const childData of data.children) {
    const oldId = childData.id;
    delete childData.id; // Let DB assign new ID
    const newId = await db.children.add(childData);
    childIdMap.set(oldId, newId);
  }

  // Import words with updated childId references
  for (const wordData of data.words) {
    const oldChildId = wordData.childId;
    const newChildId = childIdMap.get(oldChildId);
    if (newChildId) {
      wordData.childId = newChildId;
      delete wordData.id; // Let DB assign new ID
      await db.words.add(wordData);
    }
  }

  console.log(
    `Imported ${data.children.length} children and ${data.words.length} words`
  );
}

/**
 * Find the sync file in Google Drive
 */
async function findSyncFile() {
  try {
    const response = await gapi.client.drive.files.list({
      spaces: "appDataFolder",
      fields: "files(id, name, modifiedTime)",
      q: `name='${SYNC_FILE_NAME}'`,
    });

    const files = response.result.files;
    if (files && files.length > 0) {
      return files[0];
    }
    return null;
  } catch (error) {
    console.error("Error finding sync file:", error);
    throw error;
  }
}

/**
 * Upload data to Google Drive
 */
async function uploadToGoogleDrive(data) {
  const file = await findSyncFile();
  const metadata = {
    name: SYNC_FILE_NAME,
    mimeType: "application/json",
  };

  if (!file) {
    // Create new file in appDataFolder
    metadata.parents = ["appDataFolder"];
  }

  const boundary = "-------314159265358979323846";
  const delimiter = "\r\n--" + boundary + "\r\n";
  const close_delim = "\r\n--" + boundary + "--";

  const contentType = "application/json";
  const body = JSON.stringify(data);

  const multipartRequestBody =
    delimiter +
    "Content-Type: application/json\r\n\r\n" +
    JSON.stringify(metadata) +
    delimiter +
    "Content-Type: " +
    contentType +
    "\r\n\r\n" +
    body +
    close_delim;

  const method = file ? "PATCH" : "POST";
  const path = file
    ? `/upload/drive/v3/files/${file.id}`
    : "/upload/drive/v3/files";

  const response = await gapi.client.request({
    path: path,
    method: method,
    params: { uploadType: "multipart" },
    headers: {
      "Content-Type": 'multipart/related; boundary="' + boundary + '"',
    },
    body: multipartRequestBody,
  });

  return response.result;
}

/**
 * Download data from Google Drive
 */
async function downloadFromGoogleDrive() {
  const file = await findSyncFile();
  if (!file) {
    return null;
  }

  const response = await gapi.client.drive.files.get({
    fileId: file.id,
    alt: "media",
  });

  return response.result;
}

/**
 * Sync to cloud (upload current data)
 */
export async function syncToCloud() {
  if (!isSignedIn()) {
    throw new Error("Not signed in to Google Drive");
  }

  notifyStatusChange({ syncing: true });

  try {
    const data = await exportAllData();
    await uploadToGoogleDrive(data);

    const lastSync = new Date().toISOString();
    localStorage.setItem("wordmaster-last-sync", lastSync);

    console.log("Synced to cloud successfully");
    notifyStatusChange({
      connected: true,
      lastSync: lastSync,
      syncing: false,
    });

    return { success: true, lastSync };
  } catch (error) {
    console.error("Error syncing to cloud:", error);
    notifyStatusChange({ syncing: false, error: error.message });
    throw error;
  }
}

/**
 * Sync from cloud (download and merge)
 */
export async function syncFromCloud() {
  if (!isSignedIn()) {
    throw new Error("Not signed in to Google Drive");
  }

  notifyStatusChange({ syncing: true });

  try {
    const cloudData = await downloadFromGoogleDrive();

    if (!cloudData) {
      // No data in cloud, upload current data
      return await syncToCloud();
    }

    // Compare timestamps
    const localData = await exportAllData();
    const cloudTimestamp = new Date(cloudData.lastSync).getTime();
    const localTimestamp = new Date(localData.lastSync).getTime();

    if (cloudTimestamp > localTimestamp) {
      // Cloud is newer, import it
      await importAllData(cloudData);

      const lastSync = cloudData.lastSync;
      localStorage.setItem("wordmaster-last-sync", lastSync);

      console.log("Synced from cloud successfully");
      notifyStatusChange({
        connected: true,
        lastSync: lastSync,
        syncing: false,
      });

      return { success: true, imported: true, lastSync };
    } else {
      // Local is newer or same, upload to cloud
      return await syncToCloud();
    }
  } catch (error) {
    console.error("Error syncing from cloud:", error);
    notifyStatusChange({ syncing: false, error: error.message });
    throw error;
  }
}

/**
 * Get last sync timestamp
 */
export function getLastSyncTime() {
  return localStorage.getItem("wordmaster-last-sync");
}

/**
 * Notify status change
 */
function notifyStatusChange(status) {
  if (onSyncStatusChange) {
    onSyncStatusChange(status);
  }
}

/**
 * Auto-initialize when loaded
 */
export async function autoInit() {
  try {
    await initGoogleAPI();
    await initGoogleIdentity();

    // Check if we have a stored token (from previous session)
    const storedToken = localStorage.getItem("wordmaster-google-token");
    if (storedToken) {
      // Note: Token might be expired, will need to re-authenticate if so
      accessToken = storedToken;
      gapi.client.setToken({ access_token: accessToken });
    }

    return true;
  } catch (error) {
    console.error("Error auto-initializing Google Drive sync:", error);
    return false;
  }
}
