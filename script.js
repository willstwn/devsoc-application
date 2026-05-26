// Metal Pipe
function triggerSurprise() {
    const overlay = document.getElementById('pipe-falling-overlay');
    const audio = document.getElementById('pipe-falling-audio');
    overlay.style.display = 'block';
    audio.currentTime = 0;
    audio.play();
}

function closeSurprise() {
    const overlay = document.getElementById('pipe-falling-overlay');
    const audio = document.getElementById('pipe-falling-audio');
    overlay.style.display = 'none';
    audio.pause();
    audio.currentTime = 0;
}
