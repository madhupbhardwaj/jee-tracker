import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, setDoc, onSnapshot,
  collection, addDoc, query, orderBy, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const configured = window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.apiKey && window.FIREBASE_CONFIG.apiKey !== "YOUR_API_KEY";

let app, auth, db, provider;
if (configured) {
  app = initializeApp(window.FIREBASE_CONFIG);
  auth = getAuth(app);
  db = getFirestore(app);
  provider = new GoogleAuthProvider();
}

let unsubscribePrivate = null;
let unsubscribeLeaderboard = null;
let unsubscribeMessages = null;
let suppressNextEcho = false;

window.CloudSync = {
  enabled: configured,
  currentUser: null,

  async signIn() {
    if (!configured) {
      alert("Cloud sync isn't set up yet. Add your Firebase keys to firebase-config.js first.");
      return;
    }
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      console.error("Sign-in failed", e);
      alert("Sign-in failed: " + e.message);
    }
  },

  async signOutUser() {
    if (!configured) return;
    await signOut(auth);
  },

  // Private: timers + todos, only visible to the owner.
  async saveData(data) {
    if (!configured || !this.currentUser) return;
    try {
      suppressNextEcho = true;
      await setDoc(doc(db, "users", this.currentUser.uid), {
        ...data,
        updatedAt: Date.now()
      }, { merge: true });
    } catch (e) {
      console.error("Cloud save failed", e);
    }
  },

  // Public: study totals only, visible to every signed-in friend.
  async saveLeaderboardEntry(totals) {
    if (!configured || !this.currentUser) return;
    try {
      await setDoc(doc(db, "leaderboard", this.currentUser.uid), {
        name: this.currentUser.displayName || "Anonymous",
        photoURL: this.currentUser.photoURL || null,
        physics: totals.physics || 0,
        chemistry: totals.chemistry || 0,
        math: totals.math || 0,
        total: (totals.physics || 0) + (totals.chemistry || 0) + (totals.math || 0),
        updatedAt: Date.now()
      }, { merge: true });
    } catch (e) {
      console.error("Leaderboard save failed", e);
    }
  },

  subscribeLeaderboard(callback) {
    if (!configured) return;
    if (unsubscribeLeaderboard) unsubscribeLeaderboard();
    unsubscribeLeaderboard = onSnapshot(collection(db, "leaderboard"), (snap) => {
      const entries = [];
      snap.forEach(d => entries.push({ id: d.id, ...d.data() }));
      callback(entries);
    });
  },

  async sendMessage(text) {
    if (!configured || !this.currentUser || !text.trim()) return;
    try {
      await addDoc(collection(db, "groupMessages"), {
        uid: this.currentUser.uid,
        name: this.currentUser.displayName || "Anonymous",
        photoURL: this.currentUser.photoURL || null,
        text: text.trim().slice(0, 500),
        createdAt: serverTimestamp(),
        localTime: Date.now()
      });
    } catch (e) {
      console.error("Send message failed", e);
    }
  },

  subscribeMessages(callback) {
    if (!configured) return;
    if (unsubscribeMessages) unsubscribeMessages();
    const q = query(collection(db, "groupMessages"), orderBy("localTime", "desc"), limit(100));
    unsubscribeMessages = onSnapshot(q, (snap) => {
      const msgs = [];
      snap.forEach(d => msgs.push({ id: d.id, ...d.data() }));
      msgs.reverse();
      callback(msgs);
    });
  }
};

if (configured) {
  onAuthStateChanged(auth, (user) => {
    window.CloudSync.currentUser = user;
    window.dispatchEvent(new CustomEvent("cloud-auth-changed", { detail: { user } }));

    if (unsubscribePrivate) { unsubscribePrivate(); unsubscribePrivate = null; }

    if (user) {
      const ref = doc(db, "users", user.uid);
      unsubscribePrivate = onSnapshot(ref, (snap) => {
        if (suppressNextEcho) { suppressNextEcho = false; return; }
        if (snap.exists()) {
          window.dispatchEvent(new CustomEvent("cloud-data", { detail: snap.data() }));
        } else {
          window.dispatchEvent(new CustomEvent("cloud-data-empty"));
        }
      });
    }
  });
} else {
  window.dispatchEvent(new CustomEvent("cloud-unconfigured"));
}
