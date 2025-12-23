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

      // Store token for future sessions (note: tokens expire, but this allows auto-refresh)
      localStorage.setItem("wordmaster-google-token", accessToken);

      console.log("Signed in to Google Drive");
      notifyStatusChange({ connected: true, lastSync: getLastSyncTime() });
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

    // Clear stored token
    localStorage.removeItem("wordmaster-google-token");

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
 * Clear invalid/expired token and notify UI
 * Called when we get a 401 Unauthorized error
 */
function handleExpiredToken() {
  console.log("Token expired or invalid, clearing auth state");
  accessToken = null;
  gapi.client.setToken(null);
  localStorage.removeItem("wordmaster-google-token");
  notifyStatusChange({ connected: false, lastSync: null, tokenExpired: true });
}

/**
 * Check if an error is a 401 Unauthorized error
 */
function isUnauthorizedError(error) {
  return error?.status === 401 || error?.result?.error?.code === 401;
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

  // Get all deletion records
  const deletedItems = await db.deletedItems.toArray();

  return {
    version: 2, // Increment version for deletion tracking
    lastSync: new Date().toISOString(),
    children: children.map((c) => c.toJSON()),
    words: allWords.map((w) => w.toJSON()),
    deletedItems: deletedItems, // Include deletion tracking
  };
}

/**
 * Import data into IndexedDB (FULL REPLACE - used for initial sync)
 */
async function importAllData(data) {
  if (!data || (data.version !== 1 && data.version !== 2)) {
    throw new Error("Invalid data format");
  }

  // Clear existing data
  await db.children.clear();
  await db.words.clear();
  await db.deletedItems.clear();

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

  // Import deletion records (if present in v2 data)
  if (data.version === 2 && data.deletedItems) {
    for (const deletedItem of data.deletedItems) {
      delete deletedItem.id; // Let DB assign new ID
      await db.deletedItems.add(deletedItem);
    }
  }

  console.log(
    `Imported ${data.children.length} children and ${data.words.length} words`
  );
}

/**
 * Merge cloud data with local data intelligently
 * - Match children and words by name/text
 * - Update drilled status, attempts, successes, errors from cloud if cloud has more data
 * - Keep local position (queue order)
 * - Apply deletions from cloud
 */
async function mergeCloudData(cloudData) {
  if (!cloudData || (cloudData.version !== 1 && cloudData.version !== 2)) {
    throw new Error("Invalid data format");
  }

  console.log('=== MERGE STARTING ===');
  console.log(`Cloud has ${cloudData.children.length} children and ${cloudData.words.length} words`);

  // STEP 1: Apply deletions from cloud (if v2 data)
  if (cloudData.version === 2 && cloudData.deletedItems) {
    console.log(`Applying ${cloudData.deletedItems.length} deletions from cloud...`);
    for (const deletedItem of cloudData.deletedItems) {
      if (deletedItem.itemType === 'child') {
        // Find and delete child by name
        const localChildren = await getChildren();
        const childToDelete = localChildren.find(c => c.name.toLowerCase() === deletedItem.itemKey);
        if (childToDelete) {
          console.log(`🗑️ Deleting child from cloud deletion: ${childToDelete.name}`);
          // Delete without tracking (to avoid re-adding to deletedItems)
          const words = await getWords(childToDelete.id);
          for (const word of words) {
            await db.words.delete(word.id);
          }
          await db.children.delete(childToDelete.id);
        }
      } else if (deletedItem.itemType === 'word') {
        // Parse child:word format
        const [childName, wordText] = deletedItem.itemKey.split(':');
        const localChildren = await getChildren();
        const child = localChildren.find(c => c.name.toLowerCase() === childName);
        if (child) {
          const words = await getWords(child.id);
          const wordToDelete = words.find(w => w.text.toLowerCase() === wordText);
          if (wordToDelete) {
            console.log(`🗑️ Deleting word from cloud deletion: "${wordToDelete.text}" (child: ${child.name})`);
            // Delete without tracking
            await db.words.delete(wordToDelete.id);
          }
        }
      }
    }

    // Merge cloud deletions into local deletions
    for (const deletedItem of cloudData.deletedItems) {
      // Check if we already have this deletion record
      const existing = await db.deletedItems
        .where('itemKey')
        .equals(deletedItem.itemKey)
        .and(item => item.itemType === deletedItem.itemType)
        .first();

      if (!existing) {
        delete deletedItem.id;
        await db.deletedItems.add(deletedItem);
      }
    }
  }

  // STEP 2: Merge children and words

  const localChildren = await getChildren();
  console.log(`Local has ${localChildren.length} children`);

  const childNameMap = new Map(); // child name -> local child ID

  // Map local children by name
  for (const child of localChildren) {
    childNameMap.set(child.name.toLowerCase(), child.id);
    console.log(`Local child: ${child.name} (ID: ${child.id})`);
  }

  // Process cloud children - add missing ones
  for (const cloudChild of cloudData.children) {
    const childName = cloudChild.name.toLowerCase();
    if (!childNameMap.has(childName)) {
      // New child from cloud - add it
      delete cloudChild.id;
      const newId = await db.children.add(cloudChild);
      childNameMap.set(childName, newId);
      console.log(`✅ Added new child from cloud: ${cloudChild.name}`);
    }
  }

  let wordsUpdated = 0;
  let wordsAdded = 0;

  // Process cloud words
  for (const cloudWord of cloudData.words) {
    // Find the corresponding child
    const cloudChildData = cloudData.children.find(c => c.id === cloudWord.childId);
    if (!cloudChildData) {
      console.log(`⚠️ Skipping word "${cloudWord.text}" - no matching cloud child`);
      continue;
    }

    const localChildId = childNameMap.get(cloudChildData.name.toLowerCase());
    if (!localChildId) {
      console.log(`⚠️ Skipping word "${cloudWord.text}" - no local child for ${cloudChildData.name}`);
      continue;
    }

    // Find matching local word by text and childId
    const localWords = await getWords(localChildId);
    const localWord = localWords.find(w => w.text.toLowerCase() === cloudWord.text.toLowerCase());

    if (localWord) {
      // Word exists locally - merge data
      const updates = {};

      // Always take cloud's drilled status if it's true (word was learned on another device)
      if (cloudWord.drilled && !localWord.drilled) {
        updates.drilled = true;
        console.log(`✅ Marking word as drilled from cloud: "${cloudWord.text}"`);
      }

      // Take cloud's stats if they show more practice
      if (cloudWord.attempts > localWord.attempts) {
        updates.attempts = cloudWord.attempts;
        updates.successes = cloudWord.successes;
        updates.errors = cloudWord.errors;
        console.log(`✅ Updating stats from cloud for: "${cloudWord.text}" (attempts: ${localWord.attempts} -> ${cloudWord.attempts})`);
      }

      // Update lastPracticed if cloud is more recent
      if (cloudWord.lastPracticed &&
          (!localWord.lastPracticed ||
           new Date(cloudWord.lastPracticed) > new Date(localWord.lastPracticed))) {
        updates.lastPracticed = cloudWord.lastPracticed;
      }

      // Apply updates if any
      if (Object.keys(updates).length > 0) {
        await db.words.update(localWord.id, updates);
        wordsUpdated++;
      }
    } else {
      // New word from cloud - add it
      const newWord = {
        text: cloudWord.text,
        childId: localChildId,
        position: localWords.length, // Add to end of queue
        drilled: cloudWord.drilled,
        attempts: cloudWord.attempts,
        successes: cloudWord.successes,
        errors: cloudWord.errors,
        lastPracticed: cloudWord.lastPracticed,
        createdAt: cloudWord.createdAt
      };
      await db.words.add(newWord);
      wordsAdded++;
      console.log(`✅ Added new word from cloud: "${cloudWord.text}" (drilled: ${cloudWord.drilled})`);
    }
  }

  console.log(`=== MERGE COMPLETE: ${wordsUpdated} words updated, ${wordsAdded} words added ===`);
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
    if (isUnauthorizedError(error)) {
      handleExpiredToken();
    }
    throw error;
  }
}

/**
 * Upload data to Google Drive
 */
async function uploadToGoogleDrive(data) {
  try {
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
  } catch (error) {
    if (isUnauthorizedError(error)) {
      handleExpiredToken();
    }
    throw error;
  }
}

/**
 * Download data from Google Drive
 */
async function downloadFromGoogleDrive() {
  try {
    const file = await findSyncFile();
    if (!file) {
      return null;
    }

    const response = await gapi.client.drive.files.get({
      fileId: file.id,
      alt: "media",
    });

    return response.result;
  } catch (error) {
    if (isUnauthorizedError(error)) {
      handleExpiredToken();
    }
    throw error;
  }
}

/**
 * Clean up old deletion records (older than 30 days)
 * This prevents the deletedItems table from growing indefinitely
 */
async function cleanupOldDeletions() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const oldDeletions = await db.deletedItems
    .where('deletedAt')
    .below(thirtyDaysAgo.toISOString())
    .toArray();

  if (oldDeletions.length > 0) {
    console.log(`Cleaning up ${oldDeletions.length} old deletion records...`);
    for (const deletion of oldDeletions) {
      await db.deletedItems.delete(deletion.id);
    }
  }
}

/**
 * Sync to cloud (download first, then upload merged data)
 */
export async function syncToCloud() {
  if (!isSignedIn()) {
    throw new Error("Not signed in to Google Drive");
  }

  notifyStatusChange({ syncing: true });

  try {
    // First, sync down to get any changes from other devices
    const cloudData = await downloadFromGoogleDrive();

    if (cloudData) {
      console.log("Merging cloud data before uploading...");
      await mergeCloudData(cloudData);
    }

    // Clean up old deletion records
    await cleanupOldDeletions();

    // Now export and upload the merged data
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
      console.log("No cloud data found, uploading local data");
      return await syncToCloud();
    }

    // Check if this is the first sync for this device
    const localChildren = await getChildren();
    const hasLocalData = localChildren.length > 0;

    if (!hasLocalData) {
      // First sync on empty device - do full import
      console.log("First sync - importing all cloud data");
      await importAllData(cloudData);
    } else {
      // Merge cloud data with local data
      console.log("Merging cloud data with local data");
      await mergeCloudData(cloudData);
    }

    const lastSync = cloudData.lastSync;
    localStorage.setItem("wordmaster-last-sync", lastSync);

    console.log("Synced from cloud successfully");
    notifyStatusChange({
      connected: true,
      lastSync: lastSync,
      syncing: false,
    });

    return { success: true, imported: true, lastSync };
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
 * Export data for a single child
 */
async function exportChildData(childId) {
  const children = await getChildren();
  const child = children.find((c) => c.id === childId);
  if (!child) {
    throw new Error(`Child with ID ${childId} not found`);
  }

  const words = await getWords(childId);

  return {
    child: child.toJSON(),
    words: words.map((w) => w.toJSON()),
  };
}

/**
 * Merge cloud data for a single child into local data
 */
async function mergeChildData(localChildId, cloudChild, cloudWords) {
  console.log(`=== MERGING CHILD: ${cloudChild.name} ===`);

  // Get local words for this child
  const localWords = await getWords(localChildId);
  console.log(
    `Local has ${localWords.length} words, cloud has ${cloudWords.length} words`
  );

  let wordsUpdated = 0;
  let wordsAdded = 0;

  // Process cloud words
  for (const cloudWord of cloudWords) {
    const localWord = localWords.find(
      (w) => w.text.toLowerCase() === cloudWord.text.toLowerCase()
    );

    if (localWord) {
      // Word exists locally - merge data
      const updates = {};

      // Always take cloud's drilled status if it's true
      if (cloudWord.drilled && !localWord.drilled) {
        updates.drilled = true;
        console.log(`✅ Marking word as drilled from cloud: "${cloudWord.text}"`);
      }

      // Take cloud's stats if they show more practice
      if (cloudWord.attempts > localWord.attempts) {
        updates.attempts = cloudWord.attempts;
        updates.successes = cloudWord.successes;
        updates.errors = cloudWord.errors;
        console.log(
          `✅ Updating stats from cloud for: "${cloudWord.text}" (attempts: ${localWord.attempts} -> ${cloudWord.attempts})`
        );
      }

      // Update lastPracticed if cloud is more recent
      if (
        cloudWord.lastPracticed &&
        (!localWord.lastPracticed ||
          new Date(cloudWord.lastPracticed) > new Date(localWord.lastPracticed))
      ) {
        updates.lastPracticed = cloudWord.lastPracticed;
      }

      // Take audioBlob from cloud if local doesn't have it
      if (cloudWord.audioBlob && !localWord.audioBlob) {
        updates.audioBlob = cloudWord.audioBlob;
        console.log(`✅ Got audio from cloud for: "${cloudWord.text}"`);
      }

      // Apply updates if any
      if (Object.keys(updates).length > 0) {
        await db.words.update(localWord.id, updates);
        wordsUpdated++;
      }
    } else {
      // New word from cloud - add it
      const newWord = {
        text: cloudWord.text,
        childId: localChildId,
        position: localWords.length + wordsAdded, // Add to end of queue
        drilled: cloudWord.drilled,
        attempts: cloudWord.attempts,
        successes: cloudWord.successes,
        errors: cloudWord.errors,
        lastPracticed: cloudWord.lastPracticed,
        createdAt: cloudWord.createdAt,
        audioBlob: cloudWord.audioBlob,
      };
      await db.words.add(newWord);
      wordsAdded++;
      console.log(
        `✅ Added new word from cloud: "${cloudWord.text}" (drilled: ${cloudWord.drilled})`
      );
    }
  }

  console.log(
    `=== CHILD MERGE COMPLETE: ${wordsUpdated} words updated, ${wordsAdded} words added ===`
  );
}

/**
 * Sync a single child's data FROM cloud
 * Downloads cloud data and merges this child's words into local
 */
export async function syncChildFromCloud(childId) {
  if (!isSignedIn()) {
    console.log("Not signed in, skipping child sync from cloud");
    return { success: false, reason: "not_signed_in" };
  }

  console.log(`[syncChildFromCloud] Starting for childId: ${childId}`);

  try {
    // Get the local child to find their name
    const children = await getChildren();
    const localChild = children.find((c) => c.id === childId);
    if (!localChild) {
      throw new Error(`Child with ID ${childId} not found locally`);
    }

    // Download full cloud data
    const cloudData = await downloadFromGoogleDrive();
    if (!cloudData) {
      console.log("[syncChildFromCloud] No cloud data found");
      return { success: true, noCloudData: true };
    }

    // Find this child in cloud data by name
    const cloudChild = cloudData.children.find(
      (c) => c.name.toLowerCase() === localChild.name.toLowerCase()
    );

    if (!cloudChild) {
      console.log(
        `[syncChildFromCloud] Child "${localChild.name}" not found in cloud`
      );
      return { success: true, childNotInCloud: true };
    }

    // Get this child's words from cloud
    const cloudWords = cloudData.words.filter(
      (w) => w.childId === cloudChild.id
    );

    // Merge cloud data for this child
    await mergeChildData(childId, cloudChild, cloudWords);

    console.log(`[syncChildFromCloud] Complete for ${localChild.name}`);
    return { success: true };
  } catch (error) {
    console.error("[syncChildFromCloud] Error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Sync a single child's data TO cloud
 * Downloads cloud data, updates this child's portion, uploads back
 *
 * SAFETY CHECKS:
 * 1. Never delete cloud words if local has 0 words (preserve cloud data)
 * 2. Only push if local lastModified is newer than cloud lastModified
 */
export async function syncChildToCloud(childId) {
  if (!isSignedIn()) {
    console.log("Not signed in, skipping child sync to cloud");
    return { success: false, reason: "not_signed_in" };
  }

  console.log(`[syncChildToCloud] Starting for childId: ${childId}`);

  try {
    // Get local child data
    const localChildData = await exportChildData(childId);

    // Download existing cloud data
    let cloudData = await downloadFromGoogleDrive();

    if (!cloudData) {
      // No cloud data exists - create initial structure with just this child
      cloudData = {
        version: 2,
        lastSync: new Date().toISOString(),
        children: [localChildData.child],
        words: localChildData.words,
        deletedItems: [],
      };
    } else {
      // Find or add this child in cloud data
      const cloudChildIndex = cloudData.children.findIndex(
        (c) => c.name.toLowerCase() === localChildData.child.name.toLowerCase()
      );

      if (cloudChildIndex >= 0) {
        const cloudChild = cloudData.children[cloudChildIndex];
        const oldCloudChildId = cloudChild.id;
        const cloudWordsForChild = cloudData.words.filter(
          (w) => w.childId === oldCloudChildId
        );

        // SAFETY CHECK 1: Never delete cloud words if local has none
        if (localChildData.words.length === 0 && cloudWordsForChild.length > 0) {
          console.warn(
            `[syncChildToCloud] SAFETY: Preserving ${cloudWordsForChild.length} cloud words (local has none)`
          );
          return { success: true, skipped: true, reason: "preserved_cloud_words" };
        }

        // SAFETY CHECK 2: Only push if local is newer than cloud
        const localModified = new Date(localChildData.child.lastModified || 0);
        const cloudModified = new Date(cloudChild.lastModified || 0);

        if (localModified <= cloudModified) {
          console.log(
            `[syncChildToCloud] Skipping - cloud is newer or same (cloud: ${cloudModified.toISOString()}, local: ${localModified.toISOString()})`
          );
          return { success: true, skipped: true, reason: "cloud_is_newer" };
        }

        console.log(
          `[syncChildToCloud] Local is newer - pushing (local: ${localModified.toISOString()}, cloud: ${cloudModified.toISOString()})`
        );

        // Update existing child
        cloudData.children[cloudChildIndex] = localChildData.child;

        // Remove old words for this child and add new ones
        cloudData.words = cloudData.words.filter(
          (w) => w.childId !== oldCloudChildId
        );
        // Update word childIds to match cloud child ID format
        const wordsWithUpdatedChildId = localChildData.words.map((w) => ({
          ...w,
          childId: localChildData.child.id,
        }));
        cloudData.words.push(...wordsWithUpdatedChildId);
      } else {
        // Add new child to cloud
        cloudData.children.push(localChildData.child);
        cloudData.words.push(...localChildData.words);
      }

      cloudData.lastSync = new Date().toISOString();
    }

    // Upload updated cloud data
    await uploadToGoogleDrive(cloudData);

    const lastSync = new Date().toISOString();
    localStorage.setItem("wordmaster-last-sync", lastSync);

    console.log(`[syncChildToCloud] Complete for ${localChildData.child.name}`);
    return { success: true, lastSync };
  } catch (error) {
    console.error("[syncChildToCloud] Error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete a child's data from cloud
 * Downloads cloud data, removes this child's portion, uploads back
 */
export async function deleteChildFromCloud(childName) {
  if (!isSignedIn()) {
    console.log("Not signed in, skipping child deletion from cloud");
    return { success: false, reason: "not_signed_in" };
  }

  console.log(`[deleteChildFromCloud] Starting for child: ${childName}`);

  try {
    // Download existing cloud data
    let cloudData = await downloadFromGoogleDrive();

    if (!cloudData) {
      // No cloud data exists - nothing to delete
      console.log("[deleteChildFromCloud] No cloud data exists");
      return { success: true };
    }

    // Find this child in cloud data
    const cloudChildIndex = cloudData.children.findIndex(
      (c) => c.name.toLowerCase() === childName.toLowerCase()
    );

    if (cloudChildIndex >= 0) {
      const cloudChildId = cloudData.children[cloudChildIndex].id;

      // Remove child
      cloudData.children.splice(cloudChildIndex, 1);

      // Remove their words
      cloudData.words = cloudData.words.filter(
        (w) => w.childId !== cloudChildId
      );

      cloudData.lastSync = new Date().toISOString();

      // Upload updated cloud data
      await uploadToGoogleDrive(cloudData);

      console.log(`[deleteChildFromCloud] Complete for ${childName}`);
    } else {
      console.log(`[deleteChildFromCloud] Child ${childName} not found in cloud`);
    }

    return { success: true };
  } catch (error) {
    console.error("[deleteChildFromCloud] Error:", error);
    return { success: false, error: error.message };
  }
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
      // Token might be expired - set it and validate
      accessToken = storedToken;
      gapi.client.setToken({ access_token: accessToken });

      // Validate the token by making a simple API call
      try {
        await gapi.client.drive.files.list({
          spaces: "appDataFolder",
          pageSize: 1,
          fields: "files(id)",
        });
        console.log("Stored token is valid");
      } catch (error) {
        if (isUnauthorizedError(error)) {
          console.log("Stored token expired, clearing auth state");
          handleExpiredToken();
        }
      }
    }

    return true;
  } catch (error) {
    console.error("Error auto-initializing Google Drive sync:", error);
    return false;
  }
}
