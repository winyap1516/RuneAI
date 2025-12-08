import { openModal } from '../utils/dom.js';

/**
 * Opens the Add Link modal and resets the input field.
 */
export function openAddLinkModal() {
    const modal = document.getElementById('addLinkModal');
    const inpUrl = document.getElementById('inpUrl');
    
    if (modal) {
        if (inpUrl) inpUrl.value = '';
        openModal(modal);
        // Attempt to focus the input after a short delay to allow transition
        setTimeout(() => {
            if (inpUrl) inpUrl.focus();
        }, 50);
    }
}
