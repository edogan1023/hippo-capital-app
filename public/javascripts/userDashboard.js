function toggleMenu(menuId) {
    const menu = document.getElementById(menuId);
    if (menu) {
        menu.classList.toggle('hidden');
    }
}

function copyToClipboard() {
    const text = "0358 500 0000";
    navigator.clipboard.writeText(text).then(() => {
        console.log("Copied to clipboard: " + text);
    }).catch((err) => {
        console.error("Failed to copy!", err);
    });
}
