let targetColor;
let currentStreak = 0;
let bestStreak = 0;
let scores = [];

// Initialize theme from localStorage or default to dark
document.body.setAttribute('data-theme', localStorage.getItem('theme') || 'dark');

function getRandomColor() {
    const r = Math.floor(Math.random() * 256);
    const g = Math.floor(Math.random() * 256);
    const b = Math.floor(Math.random() * 256);
    return { r, g, b };
}

function rgbToHex({ r, g, b }) {
    return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toUpperCase()}`;
}

function hexToRgb(hex) {
    hex = hex.replace(/^#/, '');
    if (!/^[0-9A-F]{6}$/i.test(hex)) return null;
    
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return { r, g, b };
}

function rgbToLab(r, g, b) {
    // Convert RGB to XYZ
    r = r / 255;
    g = g / 255;
    b = b / 255;

    r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
    g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
    b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

    r *= 100;
    g *= 100;
    b *= 100;

    const x = r * 0.4124 + g * 0.3576 + b * 0.1805;
    const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
    const z = r * 0.0193 + g * 0.1192 + b * 0.9505;

    // Convert XYZ to Lab
    const xn = 95.047;
    const yn = 100.000;
    const zn = 108.883;

    const fx = x / xn > 0.008856 ? Math.pow(x / xn, 1/3) : (7.787 * x / xn) + 16/116;
    const fy = y / yn > 0.008856 ? Math.pow(y / yn, 1/3) : (7.787 * y / yn) + 16/116;
    const fz = z / zn > 0.008856 ? Math.pow(z / zn, 1/3) : (7.787 * z / zn) + 16/116;

    const L = (116 * fy) - 16;
    const a = 500 * (fx - fy);
    const b_val = 200 * (fy - fz);

    return { L, a, b: b_val };
}

function deltaE(lab1, lab2) {
    const deltaL = lab1.L - lab2.L;
    const deltaA = lab1.a - lab2.a;
    const deltaB = lab1.b - lab2.b;
    return Math.sqrt(deltaL * deltaL + deltaA * deltaA + deltaB * deltaB);
}

function getColorAnalysis(r, g, b) {
    const lab = rgbToLab(r, g, b);
    const chroma = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
    const hue = Math.atan2(lab.b, lab.a) * 180 / Math.PI;
    
    let description = [];

    // Brightness
    if (lab.L < 20) description.push("very dark");
    else if (lab.L < 40) description.push("dark");
    else if (lab.L > 80) description.push("very bright");
    else if (lab.L > 60) description.push("bright");
    else description.push("medium");

    // Saturation
    if (chroma < 10) description.push("neutral");
    else if (chroma < 30) description.push("muted");
    else if (chroma > 60) description.push("vibrant");

    // Hue
    const hueNames = [
        { name: "red", range: [-30, 30] },
        { name: "orange", range: [30, 60] },
        { name: "yellow", range: [60, 90] },
        { name: "yellow-green", range: [90, 120] },
        { name: "green", range: [120, 150] },
        { name: "cyan", range: [150, 180] },
        { name: "blue", range: [180, 240] },
        { name: "purple", range: [240, 300] },
        { name: "magenta", range: [300, 330] }
    ];

    const normalizedHue = hue < 0 ? hue + 360 : hue;
    const colorName = hueNames.find(h => 
        (normalizedHue >= h.range[0] && normalizedHue < h.range[1]) ||
        (normalizedHue >= h.range[0] - 360 && normalizedHue < h.range[1] - 360)
    )?.name || "red";

    description.push(colorName);
    return description.join(", ");
}

function updateColorMap(targetRgb, guessRgb = null) {
    const targetLab = rgbToLab(targetRgb.r, targetRgb.g, targetRgb.b);
    const points = document.getElementById('colorPoints');
    points.innerHTML = '';

    // Add target point
    const targetPoint = document.createElement('div');
    targetPoint.className = 'dot target';
    targetPoint.style.position = 'absolute';
    const targetX = ((targetLab.a + 128) / 256) * 100;
    const targetY = (targetLab.L / 100) * 100;
    targetPoint.style.left = `${targetX}%`;
    targetPoint.style.top = `${100 - targetY}%`;
    points.appendChild(targetPoint);

    // Add guess point if available
    if (guessRgb) {
        const guessLab = rgbToLab(guessRgb.r, guessRgb.g, guessRgb.b);
        const guessPoint = document.createElement('div');
        guessPoint.className = 'dot guess';
        guessPoint.style.position = 'absolute';
        const guessX = ((guessLab.a + 128) / 256) * 100;
        const guessY = (guessLab.L / 100) * 100;
        guessPoint.style.left = `${guessX}%`;
        guessPoint.style.top = `${100 - guessY}%`;
        points.appendChild(guessPoint);
    }
}

function calculateScore(targetRgb, guessRgb) {
    if (!guessRgb) return 0;

    const targetLab = rgbToLab(targetRgb.r, targetRgb.g, targetRgb.b);
    const guessLab = rgbToLab(guessRgb.r, guessRgb.g, guessRgb.b);
    
    const colorDifference = deltaE(targetLab, guessLab);
    
    const difficulty = document.getElementById("difficulty").value;
    const factors = {
        easy: 1,
        medium: 1.5,
        hard: 2
    };

    const maxDifference = 100;
    return Math.max(0, Math.round(1000 * Math.exp(-colorDifference * factors[difficulty] / maxDifference)));
}

function updateStats() {
    const averageScore = scores.length > 0 
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0;
    
    document.getElementById('averageScore').textContent = averageScore;
    document.getElementById('bestStreak').textContent = bestStreak;
    document.getElementById('streakCount').textContent = currentStreak;
}

function updateHighscores() {
    const list = document.getElementById("highscores");
    const topScores = [...new Set(scores)].sort((a, b) => b - a).slice(0, 5);
    
    list.innerHTML = topScores.map((score, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🎯';
        return `<li><span>${medal} ${score}</span><span>points</span></li>`;
    }).join('');
}

function getScoreMessage(score) {
    if (score >= 950) return `🎯 Perfect! ${score} points`;
    if (score >= 900) return `🌟 Excellent! ${score} points`;
    if (score >= 800) return `👏 Very good! ${score} points`;
    if (score >= 600) return `👍 Good job! ${score} points`;
    return `✨ Score: ${score} points`;
}

function startGame() {
    const randomColor = getRandomColor();
    targetColor = rgbToHex(randomColor);
    
    document.getElementById("colorBox").style.backgroundColor = targetColor;
    document.getElementById("guessedBox").style.backgroundColor = 'transparent';
    document.getElementById("actualBox").style.backgroundColor = 'transparent';
    document.getElementById("guessedHex").innerText = '';
    document.getElementById("actualHex").innerText = '';
    document.getElementById("guessedAnalysis").innerText = '';
    document.getElementById("actualAnalysis").innerText = '';
    document.getElementById("result").innerText = '';
    document.getElementById("hexInput").value = '';
    document.getElementById("hexInput").focus();
    
    updateColorMap(randomColor);
    
    // Hide next button and enable input
    document.getElementById("nextButton").style.display = 'none';
    document.getElementById("hexInput").disabled = false;
    document.getElementById("checkButton").disabled = false;
}

function checkColor() {
    const input = document.getElementById("hexInput").value.trim().toUpperCase();
    
    if (!input.startsWith('#')) {
        document.getElementById("result").innerHTML = '⚠️ Color must start with #';
        return;
    }
    
    const guessedColor = hexToRgb(input);
    if (!guessedColor) {
        document.getElementById("result").innerHTML = '⚠️ Invalid HEX color code!';
        return;
    }

    const targetRgb = hexToRgb(targetColor);
    const score = calculateScore(targetRgb, guessedColor);
    
    // Update streak
    if (score >= 800) {
        currentStreak++;
        bestStreak = Math.max(bestStreak, currentStreak);
    } else {
        currentStreak = 0;
    }
    
    // Update displays
    document.getElementById("result").innerHTML = getScoreMessage(score);
    document.getElementById("guessedBox").style.backgroundColor = input;
    document.getElementById("actualBox").style.backgroundColor = targetColor;
    document.getElementById("guessedHex").innerText = input;
    document.getElementById("actualHex").innerText = targetColor;
    document.getElementById("guessedAnalysis").innerText = getColorAnalysis(guessedColor.r, guessedColor.g, guessedColor.b);
    document.getElementById("actualAnalysis").innerText = getColorAnalysis(targetRgb.r, targetRgb.g, targetRgb.b);
    
    updateColorMap(targetRgb, guessedColor);
    
    scores.push(score);
    updateHighscores();
    updateStats();
    
    // Disable input and show next button
    document.getElementById("hexInput").disabled = true;
    document.getElementById("checkButton").disabled = true;
    document.getElementById("nextButton").style.display = 'block';
}

function toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

// Live color preview
document.getElementById("hexInput").addEventListener("input", function(e) {
    const input = e.target.value.trim();
    const preview = document.getElementById("colorPreview");
    
    if (/^#[0-9A-Fa-f]{6}$/.test(input)) {
        preview.style.backgroundColor = input;
    } else {
        preview.style.backgroundColor = 'transparent';
    }
});

// Enter key support
document.getElementById("hexInput").addEventListener("keypress", function(event) {
    if (event.key === "Enter" && !this.disabled) {
        checkColor();
    }
});

// Start the game
startGame();