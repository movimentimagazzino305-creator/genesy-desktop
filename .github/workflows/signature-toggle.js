/**
 * Toggle Signature Section Visibility
 * Shows signature block when quote status is "Chiuso"
 */

// Function to update signature visibility based on status
window.updateSignatureVisibility = function () {
    const statusSelect = document.getElementById('editorStatus'); // CORRETTO: era 'status-select'
    const signatureSection = document.getElementById('f-signature');

    if (!statusSelect || !signatureSection) {
        console.warn('⚠️ Elements not found!');
        return;
    }

    const currentStatus = statusSelect.value;

    // Show signature only when status is "Chiuso"
    if (currentStatus === 'Chiuso') {
        signatureSection.style.display = 'block';
    } else {
        signatureSection.style.display = 'none';
    }
};

// Listen for status changes
document.addEventListener('DOMContentLoaded', function () {

    const statusSelect = document.getElementById('editorStatus'); // CORRETTO: era 'status-select'

    if (statusSelect) {
        // Update on change
        statusSelect.addEventListener('change', function () {
            updateSignatureVisibility();
        });
    } else {
        console.warn('⚠️ Status select not found on DOMContentLoaded');
    }

    // Try to update after a delay (in case editor loads later)
    setTimeout(function () {
        updateSignatureVisibility();
    }, 1000);
});
