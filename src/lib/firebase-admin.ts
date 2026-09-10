import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import fs from 'fs';
import path from 'path';

const configPath = path.join(process.cwd(), "firebase-applet-config.json");
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

if (!getApps().length) {
  // Use explicit projectId from config to avoid picking up the Cloud Run instance project
  initializeApp({
    projectId: config.projectId,
  });
}

// Ensure we are using the correct database ID from the config
export const db = getFirestore(config.firestoreDatabaseId);
export const auth = getAuth();
