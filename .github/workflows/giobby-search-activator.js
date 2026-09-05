/**
 * ACTIVATOR for NEW Giobby Search
 * This script replaces the old search function with the new one
 */

// Wait for both giobby.js and giobby-search-new.js to load
document.addEventListener('DOMContentLoaded', () => {

    // Replace the old function with the new one
    if (window.findOrCreateGiobbyClient_NEW) {
        window.findOrCreateGiobbyClient = window.findOrCreateGiobbyClient_NEW;
    } else {
        console.error("❌ NEW Giobby Search not loaded properly!");
    }

    // Also replace the modal function
    if (window.showClientSelectionModal_NEW) {
        window.showClientSelectionModal = window.showClientSelectionModal_NEW;
    }
});
