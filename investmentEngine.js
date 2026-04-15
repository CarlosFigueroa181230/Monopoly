// 🎯 Generador de variación con probabilidades balanceadas
function getWeightedVariation() {
    const r = Math.random();

    let variation;

    if (r < 0.5) {
        // 🟢 MÁS PROBABLE (50%)
        // Centro: entre 0% y +10%
        variation = Math.random() * 0.10;

    } else if (r < 0.8) {
        // 🟡 MEDIA PROBABILIDAD (30%)
        // -5% a 0%  o  10% a 15%
        if (Math.random() < 0.5) {
            variation = -(Math.random() * 0.05); // -5% a 0%
        } else {
            variation = 0.10 + (Math.random() * 0.05); // 10% a 15%
        }

    } else {
        // 🔴 MENOS PROBABLE (20%)
        // -10% a -5%  o  15% a 20%
        if (Math.random() < 0.5) {
            variation = -0.10 + (Math.random() * 0.05); // -10% a -5%
        } else {
            variation = 0.15 + (Math.random() * 0.05); // 15% a 20%
        }
    }

    return variation;
}

export function generateOpenInvestmentPath(amount, turns) {
    let values = [amount];
    let current = amount;

    for (let i = 0; i < turns; i++) {
        const variation = getWeightedVariation();
        current = current * (1 + variation);
        values.push(current);
    }

    return values;
}

export function trapezoidalRule(values) {
    let area = 0;

    for (let i = 0; i < values.length - 1; i++) {
        area += (values[i] + values[i + 1]) / 2;
    }

    return area;
}

export function resolveOpenInvestment(amount, turns) {
    const path = generateOpenInvestmentPath(amount, turns);
    const area = trapezoidalRule(path);

    // Normalizamos el resultado respecto al área promedio
    const avg = area / turns;

    return {
        finalAmount: Math.floor(avg),
        path
    };
}