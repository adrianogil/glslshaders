#!/usr/bin/env node

// Validate both square-lattice endpoints for every state in the five-step
// colour cycle. The open endpoint permutes squares by rotating each 2x2 module
// 90 degrees about its shared corner hinge.
const mod = (value, modulus) => ((value % modulus) + modulus) % modulus;
const colorIndex = (x, y, unfolding) => mod(x + 2 * y + unfolding, 5);

function openPosition(x, y) {
  const blockX = Math.floor(x / 2);
  const blockY = Math.floor(y / 2);
  const hingeX = 2 * blockX + 0.5;
  const hingeY = 2 * blockY + 0.5;
  const dx = x - hingeX;
  const dy = y - hingeY;
  const clockwise = mod(blockX + blockY, 2) === 1;
  return clockwise
    ? [Math.round(hingeX + dy), Math.round(hingeY - dx)]
    : [Math.round(hingeX - dy), Math.round(hingeY + dx)];
}

function assertValidEndpoint(open, unfolding) {
  const colors = new Map();
  for (let y = -12; y <= 12; y += 1) {
    for (let x = -12; x <= 12; x += 1) {
      const [drawX, drawY] = open ? openPosition(x, y) : [x, y];
      const key = `${drawX},${drawY}`;
      if (colors.has(key)) throw new Error(`overlap at ${key}`);
      colors.set(key, colorIndex(x, y, unfolding));
    }
  }

  for (const [key, color] of colors) {
    const [x, y] = key.split(",").map(Number);
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const neighbor = colors.get(`${x + dx},${y + dy}`);
      if (neighbor === color) {
        throw new Error(`equal edge neighbours at ${key}, state ${unfolding}`);
      }
    }
  }
}

for (let unfolding = 0; unfolding < 5; unfolding += 1) {
  assertValidEndpoint(false, unfolding);
  assertValidEndpoint(true, unfolding);
}

for (let y = -12; y <= 12; y += 1) {
  for (let x = -12; x <= 12; x += 1) {
    if (colorIndex(x, y, 0) !== colorIndex(x, y, 5)) {
      throw new Error(`colour cycle does not close at ${x},${y}`);
    }
  }
}

console.log("Hinged-square validation passed: 5 colours, 2 endpoints, 5 states, exact 5-step closure.");
