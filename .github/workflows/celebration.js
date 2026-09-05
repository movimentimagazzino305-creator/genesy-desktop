/**
 * 🎉 CELEBRATION EFFECTS
 * Full celebration suite for successful quote closing
 */

let celebrationInterval = null;

// Create confetti particle
function createConfetti() {
    const confetti = document.createElement('div');
    confetti.classList.add('celebration-element');
    confetti.style.cssText = `
        position: fixed;
        width: 10px;
        height: 10px;
        background-color: ${['#ffd700', '#ff69b4', '#00ffff', '#00ff00', '#ff0000', '#0000ff', '#ffa500'][Math.floor(Math.random() * 7)]};
        left: ${Math.random() * 100}vw;
        top: -20px;
        opacity: 1;
        transform: rotate(${Math.random() * 360}deg);
        z-index: 300000;
        pointer-events: none;
        border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
        transition: opacity 0.5s ease-out;
    `;

    document.body.appendChild(confetti);

    const duration = 2000 + Math.random() * 2000;
    const targetY = window.innerHeight + 20;
    const drift = (Math.random() - 0.5) * 200;

    confetti.animate([
        { transform: `translate(0, 0) rotate(0deg)`, opacity: 1 },
        { transform: `translate(${drift}px, ${targetY}px) rotate(${360 * 3}deg)`, opacity: 0 }
    ], {
        duration: duration,
        easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
    }).onfinish = () => confetti.remove();
}

// Create streamer
function createStreamer() {
    const streamer = document.createElement('div');
    streamer.classList.add('celebration-element');
    const colors = ['#ff1493', '#00ffff', '#ffd700', '#ff69b4', '#00ff00'];
    const color = colors[Math.floor(Math.random() * colors.length)];

    streamer.style.cssText = `
        position: fixed;
        width: 8px;
        height: 60px;
        background: linear-gradient(to bottom, ${color}, transparent);
        left: ${Math.random() * 100}vw;
        top: -60px;
        z-index: 300000;
        pointer-events: none;
        border-radius: 4px;
        transition: opacity 0.5s ease-out;
    `;

    document.body.appendChild(streamer);

    const targetY = window.innerHeight + 60;
    const swing = (Math.random() - 0.5) * 100;

    streamer.animate([
        { transform: `translate(0, 0) rotate(0deg)`, opacity: 1 },
        { transform: `translate(${swing}px, ${targetY}px) rotate(${360 * 2}deg)`, opacity: 0.5 }
    ], {
        duration: 3000 + Math.random() * 1000,
        easing: 'ease-in'
    }).onfinish = () => streamer.remove();
}

// Launch firework burst
function createFirework(x, y) {
    const colors = ['#ffd700', '#ff69b4', '#00ffff', '#00ff00', '#ff0000', '#0000ff', '#ffa500', '#ff1493'];
    const particles = 30;

    for (let i = 0; i < particles; i++) {
        const particle = document.createElement('div');
        particle.classList.add('celebration-element');
        const angle = (Math.PI * 2 * i) / particles;
        const velocity = 100 + Math.random() * 100;

        particle.style.cssText = `
            position: fixed;
            width: 5px;
            height: 5px;
            background-color: ${colors[Math.floor(Math.random() * colors.length)]};
            border-radius: 50%;
            left: ${x}px;
            top: ${y}px;
            z-index: 300000;
            pointer-events: none;
            box-shadow: 0 0 8px currentColor;
            transition: opacity 0.5s ease-out;
        `;

        document.body.appendChild(particle);

        const dx = Math.cos(angle) * velocity;
        const dy = Math.sin(angle) * velocity;

        particle.animate([
            { transform: 'translate(0, 0) scale(1)', opacity: 1 },
            { transform: `translate(${dx}px, ${dy}px) scale(0)`, opacity: 0 }
        ], {
            duration: 1000 + Math.random() * 500,
            easing: 'cubic-bezier(0, 0.5, 0.5, 1)'
        }).onfinish = () => particle.remove();
    }
}

// Champagne bottle popping
function createChampagneBottle() {
    const bottle = document.createElement('div');
    bottle.classList.add('celebration-element');
    bottle.innerHTML = '🍾';
    const startX = Math.random() * (window.innerWidth - 100);

    bottle.style.cssText = `
        position: fixed;
        font-size: 60px;
        left: ${startX}px;
        bottom: -80px;
        z-index: 300000;
        pointer-events: none;
        filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3));
        transition: opacity 0.5s ease-out;
    `;

    document.body.appendChild(bottle);

    // Animate bottle rising and cork popping
    bottle.animate([
        { transform: 'translateY(0) rotate(0deg)', opacity: 0 },
        { transform: 'translateY(-150px) rotate(-15deg)', opacity: 1, offset: 0.5 },
        { transform: 'translateY(-200px) rotate(-20deg)', opacity: 1 }
    ], {
        duration: 1500,
        easing: 'ease-out',
        fill: 'forwards'
    });

    // Create cork and bubbles
    setTimeout(() => {
        // Cork popping
        const cork = document.createElement('div');
        cork.classList.add('celebration-element');
        cork.innerHTML = '🎊';
        cork.style.cssText = `
            position: fixed;
            font-size: 30px;
            left: ${startX + 30}px;
            bottom: ${window.innerHeight - 200}px;
            z-index: 300000;
            pointer-events: none;
            transition: opacity 0.5s ease-out;
        `;
        document.body.appendChild(cork);

        cork.animate([
            { transform: 'translate(0, 0) rotate(0deg) scale(1)', opacity: 1 },
            { transform: 'translate(50px, -100px) rotate(360deg) scale(0.5)', opacity: 0 }
        ], {
            duration: 800,
            easing: 'cubic-bezier(0.5, 0, 0.5, 1)'
        }).onfinish = () => cork.remove();

        // Champagne spray
        for (let i = 0; i < 20; i++) {
            setTimeout(() => {
                const bubble = document.createElement('div');
                bubble.classList.add('celebration-element');
                bubble.textContent = '✨';
                bubble.style.cssText = `
                    position: fixed;
                    font-size: ${10 + Math.random() * 20}px;
                    left: ${startX + 20 + Math.random() * 40}px;
                    bottom: ${window.innerHeight - 200}px;
                    z-index: 300000;
                    pointer-events: none;
                    opacity: 0.8;
                    transition: opacity 0.5s ease-out;
                `;
                document.body.appendChild(bubble);

                bubble.animate([
                    { transform: 'translate(0, 0)', opacity: 0.8 },
                    { transform: `translate(${(Math.random() - 0.5) * 100}px, ${-100 - Math.random() * 100}px)`, opacity: 0 }
                ], {
                    duration: 1000 + Math.random() * 500,
                    easing: 'ease-out'
                }).onfinish = () => bubble.remove();
            }, i * 50);
        }
    }, 750);

    setTimeout(() => bottle.remove(), 3000);
}

// Clinking glasses
function createClinkingGlasses() {
    const container = document.createElement('div');
    container.classList.add('celebration-element');
    container.style.cssText = `
        position: fixed;
        font-size: 80px;
        left: 50%;
        top: 30%;
        transform: translate(-50%, -50%);
        z-index: 300000;
        pointer-events: none;
        filter: drop-shadow(0 4px 12px rgba(0,0,0,0.3));
        transition: opacity 0.5s ease-out;
    `;

    const glass1 = document.createElement('span');
    glass1.textContent = '🥂';
    const glass2 = document.createElement('span');
    glass2.textContent = '🥂';

    glass1.style.cssText = 'display: inline-block; transform: rotate(-20deg);';
    glass2.style.cssText = 'display: inline-block; transform: rotate(20deg);';

    container.appendChild(glass1);
    container.appendChild(glass2);
    document.body.appendChild(container);

    // Animate glasses clinking
    container.animate([
        { transform: 'translate(-50%, -50%) scale(0)', opacity: 0 },
        { transform: 'translate(-50%, -50%) scale(1.3)', opacity: 1, offset: 0.3 },
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 1, offset: 0.5 },
        { transform: 'translate(-50%, -50%) scale(0.8)', opacity: 0 }
    ], {
        duration: 2000,
        easing: 'ease-in-out'
    }).onfinish = () => container.remove();

    // Sparkles on clink
    setTimeout(() => {
        for (let i = 0; i < 15; i++) {
            const sparkle = document.createElement('div');
            sparkle.classList.add('celebration-element');
            sparkle.textContent = '✨';
            sparkle.style.cssText = `
                position: fixed;
                font-size: 25px;
                left: 50%;
                top: 30%;
                z-index: 300000;
                pointer-events: none;
                transition: opacity 0.5s ease-out;
            `;
            document.body.appendChild(sparkle);

            const angle = (Math.PI * 2 * i) / 15;
            const dist = 60 + Math.random() * 40;

            sparkle.animate([
                { transform: 'translate(-50%, -50%) scale(0)', opacity: 1 },
                { transform: `translate(calc(-50% + ${Math.cos(angle) * dist}px), calc(-50% + ${Math.sin(angle) * dist}px)) scale(1)`, opacity: 0 }
            ], {
                duration: 800,
                easing: 'ease-out'
            }).onfinish = () => sparkle.remove();
        }
    }, 400);
}

// Congratulations message
function showCongratulationsMessage() {
    const message = document.createElement('div');
    message.classList.add('celebration-element'); // Add class
    message.innerHTML = `
        <div style="font-size: 80px; font-weight: bold; background: linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1, #f093fb); 
                    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
                    text-shadow: 2px 2px 4px rgba(0,0,0,0.2);">
            COMPLIMENTI!
        </div>
        <div style="font-size: 24px; color: #555; margin-top: 10px; font-weight: 600;">
            Preventivo chiuso con successo! 🎉
        </div>
    `;

    message.style.cssText = `
        position: fixed;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%) scale(0);
        z-index: 300001;
        pointer-events: none;
        text-align: center;
        filter: drop-shadow(0 8px 16px rgba(0,0,0,0.3));
        transition: opacity 0.5s ease-out;
    `;

    document.body.appendChild(message);

    // Animate message growing
    message.animate([
        { transform: 'translate(-50%, -50%) scale(0) rotate(-5deg)', opacity: 0, offset: 0 },
        { transform: 'translate(-50%, -50%) scale(1.2) rotate(2deg)', opacity: 1, offset: 0.1 },
        { transform: 'translate(-50%, -50%) scale(1) rotate(0deg)', opacity: 1, offset: 0.2 },
        { transform: 'translate(-50%, -50%) scale(1) rotate(0deg)', opacity: 1, offset: 0.9 },
        { transform: 'translate(-50%, -50%) scale(0.8) rotate(0deg)', opacity: 0, offset: 1 }
    ], {
        duration: 6000,
        easing: 'ease-out'
    }).onfinish = () => {
        message.remove();
        // Stop celebration when message disappears!
        window.stopCelebration();
    };
}

// Main celebration function - continuous
window.celebrateSuccess = function () {
    // Clear any existing celebration
    if (celebrationInterval) {
        clearInterval(celebrationInterval);
    }

    // Create background overlay with login image
    const bgOverlay = document.createElement('div');
    bgOverlay.classList.add('celebration-element', 'celebration-background');
    bgOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: url('login_bg.png') no-repeat center center;
        background-size: cover;
        z-index: 299999;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.5s ease-in-out;
    `;
    document.body.appendChild(bgOverlay);

    // Fade in background
    setTimeout(() => {
        bgOverlay.style.opacity = '1';
    }, 50);

    // Initial burst
    showCongratulationsMessage();

    // Launch confetti continuously
    celebrationInterval = setInterval(() => {
        for (let i = 0; i < 8; i++) {
            createConfetti();
        }
        for (let i = 0; i < 3; i++) {
            createStreamer();
        }
    }, 300);

    // Random special effects
    const specialEffects = [
        createChampagneBottle,
        createClinkingGlasses,
        () => {
            const x = window.innerWidth * (0.2 + Math.random() * 0.6);
            const y = window.innerHeight * (0.2 + Math.random() * 0.4);
            createFirework(x, y);
        }
    ];

    // Schedule special effects randomly throughout the export
    for (let i = 0; i < 12; i++) {
        setTimeout(() => {
            const effect = specialEffects[Math.floor(Math.random() * specialEffects.length)];
            effect();
        }, Math.random() * 8000);
    }

    // Add emoji explosion
    const emojis = ['🎉', '🎊', '✨', '🥳', '🍾', '🎆', '🎇', '💫', '⭐', '🌟'];
    for (let i = 0; i < 30; i++) {
        setTimeout(() => {
            const emoji = document.createElement('div');
            emoji.classList.add('celebration-element');
            emoji.textContent = emojis[Math.floor(Math.random() * emojis.length)];
            emoji.style.cssText = `
                position: fixed;
                font-size: ${30 + Math.random() * 30}px;
                left: ${Math.random() * 100}vw;
                top: -50px;
                z-index: 300000;
                pointer-events: none;
                filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
                transition: opacity 0.5s ease-out;
            `;
            document.body.appendChild(emoji);

            const targetY = window.innerHeight + 50;
            const rotation = Math.random() * 720 - 360;

            emoji.animate([
                { transform: `translateY(0) rotate(0deg) scale(0)`, opacity: 0 },
                { transform: `translateY(${targetY * 0.3}px) rotate(${rotation * 0.5}deg) scale(1.5)`, opacity: 1, offset: 0.3 },
                { transform: `translateY(${targetY}px) rotate(${rotation}deg) scale(0.5)`, opacity: 0 }
            ], {
                duration: 3000 + Math.random() * 2000,
                easing: 'ease-in'
            }).onfinish = () => emoji.remove();
        }, Math.random() * 6000);
    }

    // After 4 seconds, lower celebration z-index so modals come to foreground
    setTimeout(() => {
        const elements = document.querySelectorAll('.celebration-element');
        elements.forEach(el => {
            el.style.zIndex = '9990';
        });
    }, 4000);
};

// Stop celebration and fade out elements
window.stopCelebration = function () {
    if (celebrationInterval) {
        clearInterval(celebrationInterval);
        celebrationInterval = null;
    }

    // Fade out all elements
    const elements = document.querySelectorAll('.celebration-element');
    elements.forEach(el => {
        el.style.opacity = '0'; // Trigger css transition
        // Remove after transition
        setTimeout(() => el.remove(), 550);
    });
};
