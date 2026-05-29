const fs = require('fs');
const path = require('path');

function generateCubeSTL(size) {
  const h = size / 2;
  const facets = [
    // Front face (normal 0, 0, -1)
    { n: [0, 0, -1], v: [[-h, -h, -h], [-h, h, -h], [h, h, -h]] },
    { n: [0, 0, -1], v: [[-h, -h, -h], [h, h, -h], [h, -h, -h]] },
    // Back face (normal 0, 0, 1)
    { n: [0, 0, 1], v: [[-h, -h, h], [h, -h, h], [h, h, h]] },
    { n: [0, 0, 1], v: [[-h, -h, h], [h, h, h], [-h, h, h]] },
    // Left face (normal -1, 0, 0)
    { n: [-1, 0, 0], v: [[-h, -h, -h], [-h, -h, h], [-h, h, h]] },
    { n: [-1, 0, 0], v: [[-h, -h, -h], [-h, h, h], [-h, h, -h]] },
    // Right face (normal 1, 0, 0)
    { n: [1, 0, 0], v: [[h, -h, -h], [h, h, -h], [h, h, h]] },
    { n: [1, 0, 0], v: [[h, -h, -h], [h, h, h], [h, -h, h]] },
    // Top face (normal 0, 1, 0)
    { n: [0, 1, 0], v: [[-h, h, -h], [-h, h, h], [h, h, h]] },
    { n: [0, 1, 0], v: [[-h, h, -h], [h, h, h], [h, h, -h]] },
    // Bottom face (normal 0, -1, 0)
    { n: [0, -1, 0], v: [[-h, -h, -h], [h, -h, -h], [h, -h, h]] },
    { n: [0, -1, 0], v: [[-h, -h, -h], [h, -h, h], [-h, -h, h]] },
  ];

  let stl = 'solid cube\n';
  for (const f of facets) {
    stl += `  facet normal ${f.n.join(' ')}\n`;
    stl += '    outer loop\n';
    for (const v of f.v) {
      stl += `      vertex ${v.join(' ')}\n`;
    }
    stl += '    endloop\n';
    stl += '  endfacet\n';
  }
  stl += 'endsolid cube\n';
  return stl;
}

const outputPath = path.join(__dirname, 'test_cube.stl');
fs.writeFileSync(outputPath, generateCubeSTL(30));
console.log(`Generated sample STL at: ${outputPath}`);
