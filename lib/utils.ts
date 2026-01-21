// Helper for vibrant harmonic random colors
export const getRandomColors = () => {
    const baseHue = Math.floor(Math.random() * 360);
    // Two hues that are close to each other for harmony
    const h1 = baseHue;
    const h2 = (baseHue + 40) % 360;

    const s1 = 60 + Math.floor(Math.random() * 20); // 60-80% saturation
    const l1 = 20 + Math.floor(Math.random() * 15); // 20-35% lightness

    const s2 = 50 + Math.floor(Math.random() * 20);
    const l2 = 15 + Math.floor(Math.random() * 15);

    return {
        c1: `hsl(${h1}, ${s1}%, ${l1}%)`,
        c2: `hsl(${h2}, ${s2}%, ${l2}%)`
    };
};
