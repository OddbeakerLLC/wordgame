import audio from "../services/audio.js";

/**
 * About/Legal Page Component
 * Contains branding, privacy policy, and terms of service
 */
export async function renderAbout(container, onBack) {
  container.innerHTML = `
    <div class="p-4 pb-20">
      <div class="max-w-4xl mx-auto">
        <div class="card">
          <div class="flex items-center justify-between mb-6">
            <h1 class="text-3xl font-bold text-primary-600">About Word Master Challenge</h1>
            <button id="back-btn" class="btn-secondary">
              ← Back
            </button>
          </div>

          <!-- Navigation Tabs -->
          <div class="flex gap-2 mb-6 border-b-2 border-gray-200">
            <button id="tab-about" class="tab-btn active px-4 py-2 font-semibold border-b-2 -mb-0.5">
              About
            </button>
            <button id="tab-privacy" class="tab-btn px-4 py-2 font-semibold border-b-2 -mb-0.5 text-gray-600 border-transparent">
              Privacy Policy
            </button>
            <button id="tab-terms" class="tab-btn px-4 py-2 font-semibold border-b-2 -mb-0.5 text-gray-600 border-transparent">
              Terms of Service
            </button>
          </div>

          <!-- Tab Content -->
          <div id="tab-content">
            <!-- Content will be loaded here -->
          </div>
        </div>
      </div>
    </div>

    <style>
      .tab-btn.active {
        color: #8b5cf6;
        border-color: #8b5cf6;
      }
    </style>
  `;

  // Event listeners
  container.querySelector("#back-btn").addEventListener("click", () => {
    audio.playClick();
    onBack();
  });

  // Tab switching
  const tabs = container.querySelectorAll(".tab-btn");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      audio.playClick();

      // Update active state
      tabs.forEach((t) => {
        t.classList.remove("active", "text-primary-600", "border-primary-600");
        t.classList.add("text-gray-600", "border-transparent");
      });
      tab.classList.add("active", "text-primary-600", "border-primary-600");
      tab.classList.remove("text-gray-600", "border-transparent");

      // Load content
      const tabId = tab.id.replace("tab-", "");
      loadTabContent(container, tabId);
    });
  });

  // Load initial content
  loadTabContent(container, "about");
}

/**
 * Load content for a specific tab
 */
function loadTabContent(container, tabId) {
  const contentDiv = container.querySelector("#tab-content");

  switch (tabId) {
    case "about":
      contentDiv.innerHTML = getAboutContent();
      break;
    case "privacy":
      contentDiv.innerHTML = getPrivacyContent();
      break;
    case "terms":
      contentDiv.innerHTML = getTermsContent();
      break;
  }
}

/**
 * About content
 */
function getAboutContent() {
  return `
    <div class="prose max-w-none">
      <h2 class="text-2xl font-bold text-gray-800 mb-4">About Word Master Challenge</h2>

      <div class="mb-6">
        <p class="text-gray-700 mb-4">
          Word Master Challenge is a free, educational web application designed to help children learn spelling
          through interactive drills and adaptive quizzes with spaced repetition.
        </p>

        <p class="text-gray-700 mb-4">
          Built with love for parents, teachers, and children, Word Master Challenge makes learning fun and effective.
        </p>
      </div>

      <h3 class="text-xl font-bold text-gray-800 mb-3">Key Features</h3>
      <ul class="list-disc list-inside space-y-2 mb-6 text-gray-700">
        <li><strong>Word Drill Mode:</strong> Teach new words through multi-phase learning</li>
        <li><strong>Daily Quiz Mode:</strong> Practice with spaced repetition for better retention</li>
        <li><strong>Multiple Input Methods:</strong> Keyboard, on-screen buttons, or hybrid</li>
        <li><strong>Cloud Sync:</strong> Sync data across devices via Google Drive (optional)</li>
        <li><strong>Offline Support:</strong> Works completely offline as a PWA</li>
        <li><strong>Privacy-First:</strong> All data stored locally or in your Google Drive</li>
      </ul>

      <h3 class="text-xl font-bold text-gray-800 mb-3">Technology</h3>
      <p class="text-gray-700 mb-4">
        Word Master Challenge is built with modern web technologies:
      </p>
      <ul class="list-disc list-inside space-y-2 mb-6 text-gray-700">
        <li>Vanilla JavaScript (no frameworks)</li>
        <li>IndexedDB for local data storage</li>
        <li>Progressive Web App (PWA) for offline support</li>
        <li>Google Drive API for optional cloud sync</li>
        <li>Web Speech API for text-to-speech</li>
        <li>Tailwind CSS for styling</li>
      </ul>

      <h3 class="text-xl font-bold text-gray-800 mb-3">Open Source</h3>
      <p class="text-gray-700 mb-4">
        Word Master Challenge is open source and available on GitHub. Contributions, bug reports,
        and feature requests are welcome!
      </p>

      <h3 class="text-xl font-bold text-gray-800 mb-3">Contact</h3>
      <p class="text-gray-700 mb-4">
        For questions, feedback, or support, please visit our GitHub repository or
        contact us at <a href="mailto:support@oddbeaker.com" class="text-primary-600 hover:underline">support@oddbeaker.com</a>
      </p>

      <div class="mt-8 p-4 bg-gray-50 rounded-lg text-center">
        <p class="text-sm text-gray-600">
          Version 1.0.0 | Last updated: November 2025
        </p>
      </div>
    </div>
  `;
}

/**
 * Privacy Policy content
 */
function getPrivacyContent() {
  return `
    <div class="prose max-w-none">
      <h2 class="text-2xl font-bold text-gray-800 mb-4">Privacy Policy</h2>

      <p class="text-sm text-gray-600 mb-6">Last updated: November 30, 2025</p>

      <h3 class="text-xl font-bold text-gray-800 mb-3">1. Introduction</h3>
      <p class="text-gray-700 mb-4">
        Word Master Challenge ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy
        explains how we handle your information when you use our application.
      </p>

      <h3 class="text-xl font-bold text-gray-800 mb-3">2. Data Collection</h3>
      <p class="text-gray-700 mb-4">
        <strong>We do not collect, store, or transmit any personal data to our servers.</strong>
        All data is stored locally on your device using your browser's IndexedDB.
      </p>

      <h3 class="text-xl font-bold text-gray-800 mb-3">3. Local Data Storage</h3>
      <p class="text-gray-700 mb-4">
        Word Master Challenge stores the following data locally on your device:
      </p>
      <ul class="list-disc list-inside space-y-2 mb-6 text-gray-700">
        <li>Child profile information (names, settings, preferences)</li>
        <li>Word lists and spelling progress</li>
        <li>Quiz and drill statistics</li>
        <li>Application preferences</li>
      </ul>
      <p class="text-gray-700 mb-4">
        This data remains on your device and is never sent to our servers.
      </p>

      <h3 class="text-xl font-bold text-gray-800 mb-3">4. Google Drive Sync (Optional)</h3>
      <p class="text-gray-700 mb-4">
        If you choose to enable Google Drive sync:
      </p>
      <ul class="list-disc list-inside space-y-2 mb-6 text-gray-700">
        <li>Your data is stored in your personal Google Drive account</li>
        <li>Data is stored in Google Drive's App Data folder (hidden from you)</li>
        <li>We do not have access to your Google Drive or data</li>
        <li>You can revoke access at any time through your Google Account settings</li>
        <li>Google's Privacy Policy applies to data stored in Google Drive</li>
      </ul>

      <h3 class="text-xl font-bold text-gray-800 mb-3">5. Analytics and Tracking</h3>
      <p class="text-gray-700 mb-4">
        <strong>We do not use any analytics, tracking, or advertising services.</strong>
        We do not track your usage, collect behavioral data, or show advertisements.
      </p>

      <h3 class="text-xl font-bold text-gray-800 mb-3">6. Third-Party Services</h3>
      <p class="text-gray-700 mb-4">
        Word Master Challenge uses the following third-party services:
      </p>
      <ul class="list-disc list-inside space-y-2 mb-6 text-gray-700">
        <li><strong>Google Drive API:</strong> Only if you enable cloud sync (optional)</li>
        <li><strong>Google Fonts:</strong> For displaying fonts (can work offline)</li>
        <li><strong>Web Speech API:</strong> Browser built-in feature for text-to-speech</li>
      </ul>

      <h3 class="text-xl font-bold text-gray-800 mb-3">7. Children's Privacy</h3>
      <p class="text-gray-700 mb-4">
        Word Master Challenge is designed for use by children under parental or teacher supervision.
        We do not knowingly collect personal information from children. All data is managed
        by parents or teachers on the child's behalf and stored locally on the device.
      </p>

      <h3 class="text-xl font-bold text-gray-800 mb-3">8. Data Security</h3>
      <p class="text-gray-700 mb-4">
        Since all data is stored locally on your device or in your Google Drive, you are
        responsible for securing your device and Google account. We recommend:
      </p>
      <ul class="list-disc list-inside space-y-2 mb-6 text-gray-700">
        <li>Using a secure password or PIN on your device</li>
        <li>Enabling two-factor authentication on your Google account</li>
        <li>Keeping your device and browser up to date</li>
      </ul>

      <h3 class="text-xl font-bold text-gray-800 mb-3">9. Your Rights</h3>
      <p class="text-gray-700 mb-4">
        You have complete control over your data:
      </p>
      <ul class="list-disc list-inside space-y-2 mb-6 text-gray-700">
        <li><strong>Access:</strong> All data is accessible through the app</li>
        <li><strong>Deletion:</strong> You can delete profiles and words at any time</li>
        <li><strong>Export:</strong> You can export your data from the Parent/Teacher page</li>
        <li><strong>Portability:</strong> Your data is stored in standard JSON format</li>
      </ul>

      <h3 class="text-xl font-bold text-gray-800 mb-3">10. Changes to This Policy</h3>
      <p class="text-gray-700 mb-4">
        We may update this Privacy Policy from time to time. We will notify you of any
        changes by updating the "Last updated" date at the top of this policy.
      </p>

      <h3 class="text-xl font-bold text-gray-800 mb-3">11. Contact Us</h3>
      <p class="text-gray-700 mb-4">
        If you have questions about this Privacy Policy, please contact us at
        <a href="mailto:privacy@oddbeaker.com" class="text-primary-600 hover:underline">privacy@oddbeaker.com</a>
      </p>
    </div>
  `;
}

/**
 * Terms of Service content
 */
function getTermsContent() {
  return `
    <div class="prose max-w-none">
      <h2 class="text-2xl font-bold text-gray-800 mb-4">Terms of Service</h2>

      <p class="text-sm text-gray-600 mb-6">Last updated: November 30, 2025</p>

      <h3 class="text-xl font-bold text-gray-800 mb-3">1. Acceptance of Terms</h3>
      <p class="text-gray-700 mb-4">
        By accessing and using Word Master Challenge ("the Service"), you accept and agree to be bound
        by these Terms of Service. If you do not agree, please do not use the Service.
      </p>

      <h3 class="text-xl font-bold text-gray-800 mb-3">2. Use of the Service</h3>
      <p class="text-gray-700 mb-4">
        Word Master Challenge is provided free of charge for educational purposes. You may use the Service to:
      </p>
      <ul class="list-disc list-inside space-y-2 mb-6 text-gray-700">
        <li>Teach children spelling and vocabulary</li>
        <li>Create and manage child profiles</li>
        <li>Track learning progress</li>
        <li>Sync data across your devices (optional)</li>
      </ul>

      <h3 class="text-xl font-bold text-gray-800 mb-3">3. User Responsibilities</h3>
      <p class="text-gray-700 mb-4">
        You agree to:
      </p>
      <ul class="list-disc list-inside space-y-2 mb-6 text-gray-700">
        <li>Use the Service only for lawful educational purposes</li>
        <li>Supervise children's use of the Service</li>
        <li>Protect your Google account credentials (if using cloud sync)</li>
        <li>Maintain backups of important data</li>
        <li>Not attempt to reverse engineer or hack the Service</li>
        <li>Not use the Service to store inappropriate content</li>
      </ul>

      <h3 class="text-xl font-bold text-gray-800 mb-3">4. Parental Consent</h3>
      <p class="text-gray-700 mb-4">
        If you are creating profiles for children under 13, you represent that you are the
        parent or legal guardian of those children, or that you have obtained consent from
        their parent or legal guardian.
      </p>

      <h3 class="text-xl font-bold text-gray-800 mb-3">5. No Warranty</h3>
      <p class="text-gray-700 mb-4">
        The Service is provided "AS IS" and "AS AVAILABLE" without warranties of any kind,
        either express or implied, including but not limited to:
      </p>
      <ul class="list-disc list-inside space-y-2 mb-6 text-gray-700">
        <li>Fitness for a particular purpose</li>
        <li>Merchantability</li>
        <li>Non-infringement</li>
        <li>Accuracy, reliability, or completeness</li>
        <li>Uninterrupted or error-free operation</li>
      </ul>

      <h3 class="text-xl font-bold text-gray-800 mb-3">6. Limitation of Liability</h3>
      <p class="text-gray-700 mb-4">
        To the maximum extent permitted by law, we shall not be liable for any indirect,
        incidental, special, consequential, or punitive damages, including but not limited to:
      </p>
      <ul class="list-disc list-inside space-y-2 mb-6 text-gray-700">
        <li>Loss of data</li>
        <li>Loss of profits</li>
        <li>Loss of goodwill</li>
        <li>Service interruptions</li>
        <li>Device damage</li>
      </ul>

      <h3 class="text-xl font-bold text-gray-800 mb-3">7. Data Backup</h3>
      <p class="text-gray-700 mb-4">
        You are responsible for maintaining backups of your data. We recommend regularly
        exporting your data or enabling Google Drive sync as a backup.
      </p>

      <h3 class="text-xl font-bold text-gray-800 mb-3">8. Third-Party Services</h3>
      <p class="text-gray-700 mb-4">
        If you use Google Drive sync, you agree to comply with Google's Terms of Service.
        We are not responsible for any third-party services or their policies.
      </p>

      <h3 class="text-xl font-bold text-gray-800 mb-3">9. Intellectual Property</h3>
      <p class="text-gray-700 mb-4">
        Word Master Challenge is open source software. The source code is available under the MIT License.
        You may use, modify, and distribute the software in accordance with the license terms.
      </p>

      <h3 class="text-xl font-bold text-gray-800 mb-3">10. Modifications to Service</h3>
      <p class="text-gray-700 mb-4">
        We reserve the right to modify or discontinue the Service at any time, with or
        without notice. We shall not be liable to you or any third party for any modification,
        suspension, or discontinuance of the Service.
      </p>

      <h3 class="text-xl font-bold text-gray-800 mb-3">11. Termination</h3>
      <p class="text-gray-700 mb-4">
        You may stop using the Service at any time. We may terminate or suspend access to
        the Service immediately, without prior notice, for any reason.
      </p>

      <h3 class="text-xl font-bold text-gray-800 mb-3">12. Governing Law</h3>
      <p class="text-gray-700 mb-4">
        These Terms shall be governed by and construed in accordance with the laws of your
        jurisdiction, without regard to its conflict of law provisions.
      </p>

      <h3 class="text-xl font-bold text-gray-800 mb-3">13. Changes to Terms</h3>
      <p class="text-gray-700 mb-4">
        We reserve the right to modify these Terms at any time. We will notify you of any
        changes by updating the "Last updated" date at the top of these Terms.
      </p>

      <h3 class="text-xl font-bold text-gray-800 mb-3">14. Contact</h3>
      <p class="text-gray-700 mb-4">
        If you have questions about these Terms, please contact us at
        <a href="mailto:legal@oddbeaker.com" class="text-primary-600 hover:underline">legal@oddbeaker.com</a>
      </p>

      <div class="mt-8 p-4 bg-blue-50 border-2 border-blue-300 rounded-lg">
        <p class="text-sm text-gray-700">
          <strong>Summary:</strong> Word Master Challenge is free educational software. We don't collect your data,
          we provide no warranties, and you use it at your own risk. You're responsible for supervising
          children and backing up your data.
        </p>
      </div>
    </div>
  `;
}
