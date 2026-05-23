import * as THREE from 'three'
import { MeshBVH, NOT_INTERSECTED, INTERSECTED } from 'three-mesh-bvh'
import polygonClipping from 'polygon-clipping'
import earcut from 'earcut'

function multiPolyToShapes(multiPoly) {
  const shapes = []
  for (const polygon of multiPoly) {
    const outer = polygon[0]
    if (!outer || outer.length < 3) continue
    const shape = new THREE.Shape()
    shape.moveTo(outer[0][0], outer[0][1])
    for (let i = 1; i < outer.length - 1; i++) shape.lineTo(outer[i][0], outer[i][1])
    shape.closePath()
    for (let h = 1; h < polygon.length; h++) {
      const hole = polygon[h]
      if (hole.length < 3) continue
      const path = new THREE.Path()
      path.moveTo(hole[0][0], hole[0][1])
      for (let i = 1; i < hole.length - 1; i++) path.lineTo(hole[i][0], hole[i][1])
      path.closePath()
      shape.holes.push(path)
    }
    shapes.push(shape)
  }
  return shapes
}

// ── Plane-mesh intersection (BVH-accelerated) ───────────────────────────────
// Symbolic perturbation: any vertex with |d| < COINCIDE_EPS is treated as +eps
// (deterministic tiebreak — "on plane" is classified as "above"). This removes
// the d==0 ambiguity that previously dropped triangles whose vertices lay
// exactly on the slicing plane (very common with offset meshes whose Z values
// align to layerHeight multiples).
const COINCIDE_EPS = 1e-9

// ── Stitch unordered segments into closed loops ───────────────────────────────
function stitchSegments(segments, eps) {
  if (segments.length === 0) return []
  const eps2 = eps * eps
  const inv = 1.0 / eps
  const key = v =>
    `${Math.round(v.x * inv)},${Math.round(v.y * inv)},${Math.round(v.z * inv)}`

  // Build adjacency: each endpoint key → list of {segIdx, endIdx}
  const adj = new Map()
  for (let i = 0; i < segments.length; i++) {
    for (let e = 0; e < 2; e++) {
      const k = key(segments[i][e])
      if (!adj.has(k)) adj.set(k, [])
      adj.get(k).push({ i, e })
    }
  }

  const used = new Uint8Array(segments.length)
  const loops = []

  for (let start = 0; start < segments.length; start++) {
    if (used[start]) continue
    used[start] = 1

    // Start the loop with the first endpoint; then greedily follow chain
    const loop = [segments[start][0].clone()]
    let cur = segments[start][1].clone()
    const startPt = loop[0]

    for (;;) {
      // Check if we've closed back to the start
      if (cur.distanceToSquared(startPt) <= eps2 * 4) break

      // Look for an unused segment whose endpoint matches cur
      const cands = adj.get(key(cur)) ?? []
      let advanced = false
      for (const { i, e } of cands) {
        if (used[i]) continue
        used[i] = 1
        const next = segments[i][e === 0 ? 1 : 0]
        loop.push(cur)
        cur = next.clone()
        advanced = true
        break
      }
      if (!advanced) break
    }

    if (loop.length >= 3) loops.push(loop)
  }

  console.log(`[contour] stitched ${segments.length} segs -> ${loops.length} loop(s)`)
  return loops
}

// ── BVH-accelerated plane-mesh intersection ───────────────────────────────────
// Requires a MeshBVH built on the geometry. O(log T + K) per slice instead of O(T).
function planeMeshIntersectBVH(bvh, planeNormal, planeD) {
  const nx = planeNormal.x, ny = planeNormal.y, nz = planeNormal.z
  const segments = []

  bvh.shapecast({
    intersectsBounds: (box) => {
      // AABB support: min/max projection onto plane normal
      const projMin = (nx >= 0 ? nx * box.min.x : nx * box.max.x)
                    + (ny >= 0 ? ny * box.min.y : ny * box.max.y)
                    + (nz >= 0 ? nz * box.min.z : nz * box.max.z)
      const projMax = (nx >= 0 ? nx * box.max.x : nx * box.min.x)
                    + (ny >= 0 ? ny * box.max.y : ny * box.min.y)
                    + (nz >= 0 ? nz * box.max.z : nz * box.min.z)
      return (planeD >= projMin && planeD <= projMax) ? INTERSECTED : NOT_INTERSECTED
    },
    intersectsTriangle: (tri) => {
      const va = tri.a, vb = tri.b, vc = tri.c
      let da = va.dot(planeNormal) - planeD
      let db = vb.dot(planeNormal) - planeD
      let dc = vc.dot(planeNormal) - planeD
      // Symbolic perturbation — see COINCIDE_EPS comment above.
      if (Math.abs(da) < COINCIDE_EPS) da = COINCIDE_EPS
      if (Math.abs(db) < COINCIDE_EPS) db = COINCIDE_EPS
      if (Math.abs(dc) < COINCIDE_EPS) dc = COINCIDE_EPS
      const v = [va, vb, vc]
      const d = [da, db, dc]
      const ints = []
      for (let e = 0; e < 3; e++) {
        const j = (e + 1) % 3
        if ((d[e] > 0) !== (d[j] > 0)) {
          const frac = d[e] / (d[e] - d[j])
          ints.push(v[e].clone().lerp(v[j], frac))
        }
      }
      if (ints.length === 2) segments.push(ints)
      return false  // continue traversal
    }
  })

  return segments
}

// ── Orthonormal basis inside the cutting plane ────────────────────────────────
function makeBasis(planeNormal) {
  const n   = planeNormal.clone().normalize()
  const arb = Math.abs(n.x) < 0.9
    ? new THREE.Vector3(1, 0, 0)
    : new THREE.Vector3(0, 1, 0)
  const lx = new THREE.Vector3().crossVectors(n, arb).normalize()
  const ly = new THREE.Vector3().crossVectors(n, lx).normalize()
  return { lx, ly }
}

// ── Project 3D loops onto the plane's local 2D frame ─────────────────────────
function projectTo2D(loops3D, lx, ly) {
  return loops3D.map(loop =>
    loop.map(p => new THREE.Vector2(p.dot(lx), p.dot(ly)))
  )
}

function buildPolyArgs(loops2D) {
  const allRings = loops2D.filter(l => l.length >= 3)
  const rings = allRings.map(l => l.map(p => [p.x, p.y]))
  if (!rings.length) return []
  const droppedBySize = loops2D.length - allRings.length
  if (droppedBySize > 0) console.warn(`[buildPolyArgs] ${droppedBySize} ring(s) dropped (< 3 points)`)

  function area2(r) {
    let a = 0
    for (let i = 0, n = r.length; i < n; i++) {
      const j = (i + 1) % n
      a += r[i][0] * r[j][1] - r[j][0] * r[i][1]
    }
    return a
  }

  // Winding-independent point-in-ring (ray cast)
  function pip(px, py, r) {
    let inside = false
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i], [xj, yj] = r[j]
      if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi)
        inside = !inside
    }
    return inside
  }

  // Count how many other rings contain ring[i]'s first point.
  // Depth 0,2,4,... = outer boundary; depth 1,3,5,... = hole.
  // This is winding-independent — works regardless of stitching order.
  const n = rings.length
  const depths = new Int32Array(n)
  for (let i = 0; i < n; i++) {
    const [px, py] = rings[i][0]
    for (let j = 0; j < n; j++) {
      if (i !== j && pip(px, py, rings[j])) depths[i]++
    }
  }

  // Ensure each ring has correct winding convention:
  //   even depth (outer) → CCW  (area2 > 0)
  //   odd  depth (hole)  → CW   (area2 < 0)
  const oriented = rings.map((r, i) => {
    const a = area2(r)
    const shouldBeCCW = depths[i] % 2 === 0
    if ((shouldBeCCW && a < 0) || (!shouldBeCCW && a > 0)) return [...r].reverse()
    return r
  })

  // Assign holes to their direct parent outer ring (smallest area that contains them)
  const polys = []
  const outerIndices = []
  for (let i = 0; i < n; i++) {
    if (depths[i] % 2 === 0) { polys.push([oriented[i]]); outerIndices.push(i) }
  }

  for (let i = 0; i < n; i++) {
    if (depths[i] % 2 !== 1) continue  // not a direct hole
    // Find the smallest containing outer ring
    const [px, py] = rings[i][0]
    let bestPoly = null
    let bestArea = Infinity
    for (let k = 0; k < outerIndices.length; k++) {
      const oi = outerIndices[k]
      const a = Math.abs(area2(oriented[oi]))
      if (a < bestArea && pip(px, py, oriented[oi])) { bestArea = a; bestPoly = polys[k] }
    }
    if (bestPoly) bestPoly.push(oriented[i])
    else console.warn(`[buildPolyArgs] orphan hole ring (depth=${depths[i]}) — no containing outer found. Ring pt: ${px.toFixed(3)},${py.toFixed(3)}`)
  }

  // Deeper nesting (depth 2 = island inside a hole) → recurse as separate outer poly
  for (let i = 0; i < n; i++) {
    if (depths[i] % 2 === 0 && depths[i] >= 2) {
      // Already added in the outer loop above, no extra work needed
    }
  }

  return polys.length > 0 ? polys.map(p => [p]) : []
}

function canonicalizeRing(ring) {
  const points = ring.map(([x, y]) => [Math.round(x * 1e4), Math.round(y * 1e4)])
  if (points.length > 1) {
    const first = points[0]
    const last = points[points.length - 1]
    if (first[0] === last[0] && first[1] === last[1]) points.pop()
  }
  if (points.length === 0) return ''

  const serialize = pts => pts.map(([x, y]) => `${x}:${y}`).join(';')
  const rotateMin = pts => {
    let minIdx = 0
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i]
      const [bx, by] = pts[minIdx]
      if (ax < bx || (ax === bx && ay < by)) minIdx = i
    }
    return pts.slice(minIdx).concat(pts.slice(0, minIdx))
  }

  const forward = rotateMin(points)
  const backward = rotateMin([...points].reverse())
  const forwardKey = serialize(forward)
  const backwardKey = serialize(backward)
  return forwardKey < backwardKey ? forwardKey : backwardKey
}

function sliceSignature(multiPoly) {
  return multiPoly
    .map(polygon => polygon.map(canonicalizeRing).sort().join('|'))
    .sort()
    .join('||')
}


// =============================================================================
// STEP 0 — 3D MESH OFFSET  (mirrors MeshLib's offsetVerts / MROffsetVerts.cpp)
// =============================================================================
// MeshLib reference (MRMeshMath.cpp pseudonormal(VertId v)):
//   sum += angle(d0,d1) * cross(d0,d1).normalized()
//   return sum.normalized()
//
// where d0,d1 are the two edges of one adjacent face originating at v, so the
// per-face contribution is  (interior_angle_at_v) × (unit face normal).
//
// This is the THÜRMER–WÜTHRICH angle-weighted pseudonormal — the only
// weighting guaranteed to produce a tessellation-invariant, inside/outside-
// consistent normal, which is what offsetVerts requires.  Area weighting
// (cross product un-normalized = dirDblArea) is what the bulk shading-normals
// path uses, but offsetVerts deliberately calls the angle-weighted one.
//
// Pipeline:
//   1. Group all coincident vertices by quantized position.
//   2. For each triangle, compute its UNIT normal and the interior angle at
//      each of its 3 corners; add (angle × unit_normal) to each corner's
//      coincident-vertex group.
//   3. Normalize each group's accumulator.
//   4. Displace every vertex in a group by the SAME (pseudonormal × offset)
//      so coincident vertices stay coincident → mesh remains manifold.
export function offsetMeshVerts(geometry, offset) {
  if (Math.abs(offset) < 1e-10) return geometry

  let geom = geometry.clone()
  if (geom.index) geom = geom.toNonIndexed()

  const pos = geom.attributes.position
  const n = pos.count

  // ── 1. Group coincident vertices by quantized position ─────────────────
  const P = 1e4 // 0.0001 unit tolerance — fine for CAD meshes in mm
  const keyOf = i =>
    `${Math.round(pos.getX(i) * P)},${Math.round(pos.getY(i) * P)},${Math.round(pos.getZ(i) * P)}`

  const posMap = new Map() // key → { indices[], nx, ny, nz }
  for (let i = 0; i < n; i++) {
    const k = keyOf(i)
    let entry = posMap.get(k)
    if (!entry) { entry = { indices: [], nx: 0, ny: 0, nz: 0 }; posMap.set(k, entry) }
    entry.indices.push(i)
  }

  // ── 2. Per-triangle: accumulate (interior_angle × unit_face_normal) ─────
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3()
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), nrm = new THREE.Vector3()

  // Robust angle between two non-zero vectors: atan2(|cross|, dot) ∈ (0, π).
  // Far more accurate than acos(dot/|a|/|b|) near 0 and π.
  const angleBetween = (u, v) => {
    const cx = u.y * v.z - u.z * v.y
    const cy = u.z * v.x - u.x * v.z
    const cz = u.x * v.y - u.y * v.x
    const sinMag = Math.sqrt(cx * cx + cy * cy + cz * cz)
    return Math.atan2(sinMag, u.x * v.x + u.y * v.y + u.z * v.z)
  }

  for (let i = 0; i < n; i += 3) {
    va.fromBufferAttribute(pos, i)
    vb.fromBufferAttribute(pos, i + 1)
    vc.fromBufferAttribute(pos, i + 2)

    // Unit face normal (skip degenerate triangles)
    e1.subVectors(vb, va)
    e2.subVectors(vc, va)
    nrm.crossVectors(e1, e2)
    const area2 = nrm.length()
    if (area2 < 1e-20) continue
    nrm.multiplyScalar(1 / area2) // normalized in place

    // Interior angles at va, vb, vc
    // angle at va: between (vb-va) and (vc-va)
    const angA = angleBetween(e1, e2)
    // angle at vb: between (va-vb) and (vc-vb)
    e1.subVectors(va, vb); e2.subVectors(vc, vb)
    const angB = angleBetween(e1, e2)
    // angle at vc: between (va-vc) and (vb-vc)
    e1.subVectors(va, vc); e2.subVectors(vb, vc)
    const angC = angleBetween(e1, e2)

    const ka = keyOf(i),     ea = posMap.get(ka)
    const kb = keyOf(i + 1), eb = posMap.get(kb)
    const kc = keyOf(i + 2), ec = posMap.get(kc)

    ea.nx += angA * nrm.x; ea.ny += angA * nrm.y; ea.nz += angA * nrm.z
    eb.nx += angB * nrm.x; eb.ny += angB * nrm.y; eb.nz += angB * nrm.z
    ec.nx += angC * nrm.x; ec.ny += angC * nrm.y; ec.nz += angC * nrm.z
  }

  // ── 3 + 4. Normalize each group's pseudonormal & displace all members ──
  let degenerate = 0
  for (const { indices, nx, ny, nz } of posMap.values()) {
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz)
    if (len < 1e-12) { degenerate++; continue }
    const ux = nx / len, uy = ny / len, uz = nz / len
    const dx = ux * offset, dy = uy * offset, dz = uz * offset
    for (const idx of indices) {
      pos.setXYZ(idx, pos.getX(idx) + dx, pos.getY(idx) + dy, pos.getZ(idx) + dz)
    }
  }

  pos.needsUpdate = true
  geom.computeVertexNormals()
  geom.computeBoundingBox()
  geom.computeBoundingSphere()

  console.log(`[offsetMeshVerts] groups=${posMap.size}, faces=${n / 3}, ` +
              `offset=${offset}, degenerate=${degenerate}`)
  return geom
}

// =============================================================================
// CONTOUR OFFSET  (mirrors MeshLib's MROffsetContours algorithm)
// =============================================================================
// Each ring is offset by moving each vertex to the intersection of the two
// adjacent offset-edges.  This is the "miter join" strategy used by MeshLib's
// offsetOneDirectionContour.  A miter limit (10× offset) prevents extreme
// spikes at very sharp corners; parallel edges fall back to the midpoint.
//
// Sign convention (matches polygon-clipping output winding):
//   CCW outer ring → positive offset expands  (moves in left-normal direction)
//   CW  hole ring  → positive offset SHRINKS the hole (moves in right-normal)
//
function offsetRing(ring, offset) {
  if (Math.abs(offset) < 1e-10) return ring
  const closed = ring.length > 1 &&
    ring[0][0] === ring[ring.length-1][0] && ring[0][1] === ring[ring.length-1][1]
  const count = closed ? ring.length - 1 : ring.length
  if (count < 3) return ring

  // Signed 2× area: positive = CCW outer, negative = CW hole
  let a2 = 0
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % count
    a2 += ring[i][0] * ring[j][1] - ring[j][0] * ring[i][1]
  }
  // For CCW outer: d > 0 moves in left-normal (outward) → expands.
  // For CW hole:   d < 0 moves in right-normal (outward for hole) → shrinks hole.
  const d = a2 >= 0 ? offset : -offset

  // Compute each edge shifted by d in its left-normal direction
  const oEdges = []
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % count
    const ex = ring[j][0] - ring[i][0]
    const ey = ring[j][1] - ring[i][1]
    const el = Math.sqrt(ex*ex + ey*ey)
    if (el < 1e-12) { oEdges.push(null); continue }
    const nx = -ey/el * d   // left-normal × d
    const ny =  ex/el * d
    oEdges.push({
      x1: ring[i][0] + nx,  y1: ring[i][1] + ny,
      x2: ring[j][0] + nx,  y2: ring[j][1] + ny,
    })
  }

  const maxMiter = Math.abs(d) * 10 + 1e-4   // cap miter length
  const pts = []
  for (let i = 0; i < count; i++) {
    const eIn  = oEdges[(i - 1 + count) % count]  // incoming offset edge
    const eOut = oEdges[i]                          // outgoing offset edge
    if (!eIn || !eOut) { pts.push([ring[i][0], ring[i][1]]); continue }

    // Intersect line(eIn) with line(eOut) using Cramer's rule
    const den = (eIn.x1-eIn.x2)*(eOut.y1-eOut.y2) - (eIn.y1-eIn.y2)*(eOut.x1-eOut.x2)
    if (Math.abs(den) < 1e-12) {
      // Parallel edges — use midpoint of junction
      pts.push([(eIn.x2 + eOut.x1) * 0.5, (eIn.y2 + eOut.y1) * 0.5])
    } else {
      const t = ((eIn.x1-eOut.x1)*(eOut.y1-eOut.y2) - (eIn.y1-eOut.y1)*(eOut.x1-eOut.x2)) / den
      const ix = eIn.x1 + t*(eIn.x2-eIn.x1)
      const iy = eIn.y1 + t*(eIn.y2-eIn.y1)
      // Miter limit: if the spike is too long, clip it back
      const dx = ix - eIn.x2,  dy = iy - eIn.y2
      const distSq = dx*dx + dy*dy
      if (distSq > maxMiter * maxMiter) {
        const dl = Math.sqrt(distSq)
        pts.push([eIn.x2 + dx/dl * maxMiter, eIn.y2 + dy/dl * maxMiter])
      } else {
        pts.push([ix, iy])
      }
    }
  }

  if (closed && pts.length > 0) pts.push([pts[0][0], pts[0][1]])
  return pts
}

// Offset every ring in a polygon-clipping MultiPolygon
function offsetMultiPoly(multiPoly, offset) {
  if (Math.abs(offset) < 1e-10) return multiPoly
  return multiPoly.map(polygon => polygon.map(ring => offsetRing(ring, offset)))
}

// =============================================================================
// PUBLIC API
// =============================================================================

export function extractContour(geometry, direction, { layerHeight = 0.2, offset = 0 } = {}) {
  const dir = new THREE.Vector3(direction.x, direction.y, direction.z)
  if (dir.lengthSq() < 1e-10) throw new Error('Sweep direction is zero vector')
  dir.normalize()

  let geom = geometry.clone()
  if (geom.index) geom = geom.toNonIndexed()

  geom.computeBoundingBox()
  const bbSize = new THREE.Vector3()
  geom.boundingBox.getSize(bbSize)
  const eps = Math.max(bbSize.x, bbSize.y, bbSize.z) * 1e-5

  const pos = geom.attributes.position
  let eMin = Infinity, eMax = -Infinity
  for (let i = 0; i < pos.count; i++) {
    const d = pos.getX(i) * dir.x + pos.getY(i) * dir.y + pos.getZ(i) * dir.z
    if (d < eMin) eMin = d
    if (d > eMax) eMax = d
  }

  const { lx, ly } = makeBasis(dir)

  // Build BVH once — O(T log T) up front, then O(log T + K) per slice instead of O(T)
  const bvh = new MeshBVH(geom)

  const allLoops3D = []
  const slices = []
  let totalSlices = 0
  let slicesWithContours = 0
  const skipLog = { noSegments: 0, noLoops: 0, noPolyArgs: 0, unionFail: 0, noShapes: 0, jitterRescued: 0 }
  const skipDetails = []

  // Try to slice at planeD; if it produces no segments or no closed loops,
  // retry with tiny jitter (covers degenerate cases not handled by symbolic
  // perturbation, e.g. an entire triangle lying within COINCIDE_EPS of plane).
  const JITTER_OFFSETS = [
    +layerHeight * 1e-3, -layerHeight * 1e-3,
    +layerHeight * 1e-2, -layerHeight * 1e-2,
    +layerHeight * 5e-2, -layerHeight * 5e-2,
  ]
  function sliceAt(planeD) {
    const segs = planeMeshIntersectBVH(bvh, dir, planeD)
    if (segs.length === 0) return { segs, loops: [], usedPlaneD: planeD }
    const loops = stitchSegments(segs, eps)
    return { segs, loops, usedPlaneD: planeD }
  }

  for (let planeD = eMin + layerHeight * 0.5; planeD < eMax; planeD += layerHeight) {
    totalSlices++
    let { segs: segments, loops: loops3D, usedPlaneD } = sliceAt(planeD)

    // Jitter retry if we got nothing usable
    if (segments.length === 0 || loops3D.length === 0) {
      let rescued = false
      for (const dz of JITTER_OFFSETS) {
        const r = sliceAt(planeD + dz)
        if (r.segs.length > 0 && r.loops.length > 0) {
          segments = r.segs; loops3D = r.loops; usedPlaneD = r.usedPlaneD
          skipLog.jitterRescued++
          rescued = true
          break
        }
      }
      if (!rescued) {
        if (segments.length === 0) {
          skipLog.noSegments++
        } else {
          skipLog.noLoops++
          skipDetails.push(`  z=${planeD.toFixed(4)}: ${segments.length} segs but 0 loops (stitching failed; jitter retry also failed)`)
        }
        continue
      }
    }

    allLoops3D.push(...loops3D)
    slicesWithContours++

    const loops2D = projectTo2D(loops3D, lx, ly)
    const polyArgs = buildPolyArgs(loops2D)
    if (polyArgs.length === 0) {
      skipLog.noPolyArgs++
      skipDetails.push(`  z=${usedPlaneD.toFixed(4)}: ${loops3D.length} loops but buildPolyArgs returned [] (all rings orphaned?)`)
      continue
    }

    let unionResult
    try {
      // buildPolyArgs returns MultiPolygon[] — each element is already a valid MultiPolygon.
      // Single-polygon: use directly. Multi: union all into one MultiPolygon.
      unionResult = polyArgs.length === 1
        ? polyArgs[0]
        : polygonClipping.union(...polyArgs)
    } catch (e) {
      skipLog.unionFail++
      console.warn(`[contour] slice union at ${usedPlaneD.toFixed(3)} failed:`, e.message)
      skipDetails.push(`  z=${usedPlaneD.toFixed(4)}: polygon-clipping union threw — ${e.message}`)
      unionResult = polyArgs[0]
    }

    const shapes = multiPolyToShapes(unionResult)
    if (!shapes?.length) {
      skipLog.noShapes++
      skipDetails.push(`  z=${usedPlaneD.toFixed(4)}: unionResult valid but multiPolyToShapes returned [] — unionResult=${JSON.stringify(unionResult).slice(0,120)}`)
      continue
    }

    // Apply contour offset (miter-join, per MeshLib MROffsetContours algorithm)
    if (Math.abs(offset) > 1e-10) {
      try {
        unionResult = offsetMultiPoly(unionResult, offset)
      } catch (e) {
        console.warn(`[contour] offset failed at z=${usedPlaneD.toFixed(3)}:`, e.message)
      }
    }

    slices.push({
      planeD: planeD,            // keep nominal layer position for downstream merging
      poly: unionResult,         // raw MultiPolygon — kept for accumulateContours
      shapes,
      signature: sliceSignature(unionResult),
    })
  }

  console.log(`[contour] ${slicesWithContours}/${totalSlices} slices, ${allLoops3D.length} loops, ${slices.length} profiles`)
  console.log('[contour] skip breakdown:', skipLog)
  if (skipDetails.length > 0) console.warn('[contour] skipped slices:\n' + skipDetails.join('\n'))

  // Warn about gaps in the slice sequence (consecutive planeDiffs > 1.5×layerHeight)
  for (let i = 1; i < slices.length; i++) {
    const gap = slices[i].planeD - slices[i-1].planeD
    if (gap > layerHeight * 1.5)
      console.warn(`[contour] GAP between slice ${i-1} (z=${slices[i-1].planeD.toFixed(3)}) and ${i} (z=${slices[i].planeD.toFixed(3)}): ${gap.toFixed(3)} (${(gap/layerHeight).toFixed(1)}× layerHeight)`)
  }

  if (slices.length === 0)
    throw new Error('No cross-section found. Try a different sweep direction.')

  const mergedSlices = []
  for (const slice of slices) {
    const prev = mergedSlices[mergedSlices.length - 1]
    const expectedGap = prev ? Math.abs(slice.planeD - prev.planeDEnd - layerHeight) : Infinity
    if (prev && prev.signature === slice.signature && expectedGap < layerHeight * 0.25) {
      prev.planeDEnd = slice.planeD
      continue
    }

    mergedSlices.push({
      planeDStart: slice.planeD,
      planeDEnd: slice.planeD,
      poly:      slice.poly,
      shapes:    slice.shapes,
      signature: slice.signature,
    })
  }

  const stats = {
    inputVertices:      pos.count,
    layerHeight,
    totalSlices,
    slicesWithContours,
    loops:              allLoops3D.length,
    totalContourPoints: allLoops3D.reduce((s, l) => s + l.length, 0),
    profileShapes:      slices.length,
    mergedExtrusions:   mergedSlices.length,
    meshExtentMin:      eMin,
    meshExtentMax:      eMax,
  }
  console.log('[contour] stats:', stats)

  return { loops3D: allLoops3D, slices, mergedSlices, lx, ly, meshExtentMin: eMin, meshExtentMax: eMax, stats }
}

/**
 * STEP 1b — Accumulate contour profiles forward.
 *
 * Replaces each slice's 2D profile with the union of itself and every
 * preceding slice's profile (a running forward union).
 *
 * Effect: the profile can only grow or stay the same as you move along
 * the sweep axis.  Consecutive identical profiles get run-merged into
 * one long prism, dramatically reducing the number of CSG operations.
 *
 * NOTE: this changes the swept solid's cross-section to always be a
 * superset of the start-end geometry — use when you want the
 * "maximum material" envelope rather than the exact Minkowski sum.
 */
export function accumulateContours(contour) {
  const { slices, lx, ly, meshExtentMin, meshExtentMax, stats } = contour

  if (!slices?.length) throw new Error('accumulateContours: no input slices.')

  // Per-slice bookkeeping so nothing fails silently
  const skip = {
    nullPoly:        0,  // slice.poly missing/empty (now CARRIED FORWARD, not dropped)
    unionFailed:     0,  // safeUnion returned 'failed' (data lost)
    unionRetry:      0,  // safeUnion needed quantization retry (minor data loss)
    emptyShapes:     0,  // accPoly produced no THREE.Shape after union (CARRIED FORWARD)
    leadingNullsDropped: 0, // null slices BEFORE any valid one — unavoidable drop
    carriedForward:  0,  // count of slices that reused the previous accPoly
  }
  const skipDetails = []   // per-event human-readable rows

  let accPoly = null
  let lastValidShapes = null
  const accSlices = []

  for (let i = 0; i < slices.length; i++) {
    const slice = slices[i]
    const sliceLabel = `slice[${i}] z=${slice?.planeD?.toFixed(3) ?? '?'}`

    // ── Slice has no usable polygon: carry forward the previous accumulated
    //    state.  Since the running profile is monotone (each slice ⊇ previous),
    //    this is geometrically correct: a slice that contributes nothing leaves
    //    the accumulated profile unchanged from the slice before it.  This
    //    GUARANTEES the loft sees a continuous slice sequence (no gaps, no
    //    skipped layers).
    if (!slice?.poly || !Array.isArray(slice.poly) || slice.poly.length === 0) {
      skip.nullPoly++
      if (accPoly !== null && lastValidShapes !== null) {
        skip.carriedForward++
        skipDetails.push(`${sliceLabel}: poly null/empty → carried forward previous accumulated profile`)
        accSlices.push({
          planeD:    slice.planeD,
          poly:      accPoly,
          shapes:    lastValidShapes,
          signature: accSlices[accSlices.length - 1]?.signature ?? sliceSignature(accPoly),
        })
      } else {
        skip.leadingNullsDropped++
        skipDetails.push(`${sliceLabel}: poly null/empty AND no prior valid slice — dropped (cannot carry forward from nothing)`)
      }
      continue
    }

    if (accPoly === null) {
      accPoly = slice.poly
    } else {
      const { result, status } = safeUnion(accPoly, slice.poly, sliceLabel, accPoly)
      if (status === 'failed') {
        skip.unionFailed++
        skipDetails.push(`${sliceLabel}: union failed (data lost)`)
      } else if (status.startsWith('retry')) {
        skip.unionRetry++
        skipDetails.push(`${sliceLabel}: union ${status}`)
      }
      accPoly = result
    }

    const shapes = multiPolyToShapes(accPoly)
    if (!shapes?.length) {
      skip.emptyShapes++
      // Carry forward — the geometry didn't actually disappear, just wouldn't
      // shape-ify; reuse the prior valid shapes so the loft slab remains.
      if (lastValidShapes !== null) {
        skip.carriedForward++
        skipDetails.push(`${sliceLabel}: accPoly→no shapes (poly len=${accPoly?.length}) → carried forward last valid shapes`)
        accSlices.push({
          planeD:    slice.planeD,
          poly:      accPoly,
          shapes:    lastValidShapes,
          signature: accSlices[accSlices.length - 1]?.signature ?? sliceSignature(accPoly),
        })
      } else {
        skip.leadingNullsDropped++
        skipDetails.push(`${sliceLabel}: accPoly→no shapes AND no prior valid shapes — dropped`)
      }
      continue
    }
    lastValidShapes = shapes
    accSlices.push({
      planeD:    slice.planeD,
      poly:      accPoly,
      shapes,
      signature: sliceSignature(accPoly),
    })
  }

  // ── Loud diagnostics: report every drop class ───────────────────────────
  const totalSkipped = skip.unionFailed + skip.leadingNullsDropped
  if (totalSkipped > 0 || skip.unionRetry > 0 || skip.carriedForward > 0) {
    console.groupCollapsed(
      `[accumulate] DIAGNOSTICS — input=${slices.length} kept=${accSlices.length} ` +
      `carriedForward=${skip.carriedForward} dropped=${totalSkipped} ` +
      `(nullPoly=${skip.nullPoly}, unionFailed=${skip.unionFailed}, ` +
      `emptyShapes=${skip.emptyShapes}, leadingNullsDropped=${skip.leadingNullsDropped}, unionRetry=${skip.unionRetry})`
    )
    skipDetails.forEach(d => console.warn('  ' + d))
    console.groupEnd()
  }

  // Union failures fall back to the previous accumulated polygon (see safeUnion → fallbackA),
  // so the loft is still complete — just missing the incremental growth from those slices.
  // Warn and continue rather than hard-failing on dense meshes with near-degenerate contours.
  if (skip.unionFailed > 0) {
    console.warn(
      `accumulateContours: ${skip.unionFailed} union operation(s) failed even after retry — ` +
      `affected slices carried forward the previous accumulated profile. See console for details.`
    )
  }

  if (accSlices.length === 0) {
    throw new Error(
      `accumulateContours: no valid slices produced. ` +
      `input=${slices.length}, nullPoly=${skip.nullPoly}, unionFailed=${skip.unionFailed}, ` +
      `emptyShapes=${skip.emptyShapes}, leadingNullsDropped=${skip.leadingNullsDropped}.`
    )
  }

  // Reconstruct loops3D from the accumulated 2D polygons so the viewer shows
  // the grown profiles.  Un-project: p3D = planeD·dir + px·lx + py·ly
  const dir3 = new THREE.Vector3().crossVectors(lx, ly).normalize()
  const accLoops3D = []
  for (const slice of accSlices) {
    const origin = dir3.clone().multiplyScalar(slice.planeD)
    for (const polygon of slice.poly) {
      for (const ring of polygon) {
        if (ring.length < 3) continue
        const loop = ring
          .slice(0, ring.length)  // may be closed (first==last) — keep all for display
          .map(([px, py]) =>
            origin.clone()
              .addScaledVector(lx, px)
              .addScaledVector(ly, py)
          )
        accLoops3D.push(loop)
      }
    }
  }

  // Re-run the merge step on the now-monotone profiles
  const layerHeight = stats.layerHeight
  const mergedSlices = []
  for (const slice of accSlices) {
    const prev = mergedSlices[mergedSlices.length - 1]
    const gap  = prev ? Math.abs(slice.planeD - prev.planeDEnd - layerHeight) : Infinity
    if (prev && prev.signature === slice.signature && gap < layerHeight * 0.25) {
      prev.planeDEnd = slice.planeD
      continue
    }
    mergedSlices.push({
      planeDStart: slice.planeD,
      planeDEnd:   slice.planeD,
      poly:        slice.poly,
      shapes:      slice.shapes,
      signature:   slice.signature,
    })
  }

  console.log(`[accumulate] ${accSlices.length} slices -> ${mergedSlices.length} merged extrusions`)

  // Warn about gaps in the accumulated slice sequence
  for (let i = 1; i < accSlices.length; i++) {
    const gap = accSlices[i].planeD - accSlices[i-1].planeD
    if (gap > layerHeight * 1.5)
      console.warn(`[accumulate] GAP between acc slice ${i-1} (z=${accSlices[i-1].planeD.toFixed(3)}) and ${i} (z=${accSlices[i].planeD.toFixed(3)}): ${gap.toFixed(3)} = ${(gap/layerHeight).toFixed(1)}× layerHeight`)
  }

  // Log merged slice table
  console.groupCollapsed(`[accumulate] merged slice table (${mergedSlices.length} slabs)`)
  mergedSlices.forEach((s, i) => {
    const height = s.planeDEnd - s.planeDStart
    const rings  = s.poly?.reduce((a, p) => a + p.length, 0) ?? 0
    console.log(`  [${i}] z=${s.planeDStart.toFixed(3)}–${s.planeDEnd.toFixed(3)} h=${height.toFixed(3)} rings=${rings}`)
  })
  console.groupEnd()

  const newStats = {
    ...stats,
    profileShapes:    accSlices.length,
    mergedExtrusions: mergedSlices.length,
    accumulated:      true,
    accSkipped:       totalSkipped,
    accCarriedForward: skip.carriedForward,
    accUnionRetries:  skip.unionRetry,
  }

  return { ...contour, loops3D: accLoops3D, slices: accSlices, mergedSlices, stats: newStats }
}

// ── Polygon simplification for clipping robustness ───────────────────────────
// Quantizes ring coordinates to `tol` units, merging near-coincident vertices.
// This prevents polygon-clipping's recursive sweep from stack-overflowing on
// polygons that share thousands of near-identical edge events.
function simplifyRing(ring, tol) {
  const inv = 1 / tol
  const out = []
  for (const pt of ring) {
    const x = Math.round(pt[0] * inv) / inv
    const y = Math.round(pt[1] * inv) / inv
    const prev = out[out.length - 1]
    if (!prev || prev[0] !== x || prev[1] !== y) out.push([x, y])
  }
  // Remove closing duplicate
  if (out.length > 1) {
    const [fx, fy] = out[0], [lx, ly] = out[out.length - 1]
    if (fx === lx && fy === ly) out.pop()
  }
  return out.length >= 3 ? out : null
}

function simplifyMultiPoly(mp, tol) {
  const result = []
  for (const poly of mp) {
    const rings = poly.map(r => simplifyRing(r, tol)).filter(Boolean)
    if (rings.length > 0) result.push(rings)
  }
  return result.length > 0 ? result : null
}

// Compute polygon difference with automatic retry on numerical failures.
// polygon-clipping can fail with:
//   - "Maximum call stack size exceeded"  — too many near-coincident edge events
//   - "Unable to complete output ring…"   — floating-point noise creates open rings
// Both are cured by quantizing coordinates to merge near-coincident vertices.
// We try progressively coarser tolerances until one works or all fail.
function safeDifference(polyA, polyB, label) {
  const isRetryable = msg =>
    msg?.toLowerCase().includes('call stack') ||
    msg?.toLowerCase().includes('unable to complete output ring')

  // First try at full precision
  try {
    return polygonClipping.difference(polyA, polyB)
  } catch (e0) {
    if (!isRetryable(e0.message)) {
      console.warn(`[loft] shelf diff failed at ${label}: ${e0.message}`)
      return []
    }
  }

  // Retry with progressively coarser quantization
  for (const tol of [1e-4, 1e-3, 1e-2]) {
    try {
      const a = simplifyMultiPoly(polyA, tol) ?? polyA
      const b = simplifyMultiPoly(polyB, tol) ?? polyB
      const result = polygonClipping.difference(a, b)
      console.warn(`[loft] shelf diff retry succeeded at tol=${tol} for ${label}`)
      return result
    } catch (e) {
      if (!isRetryable(e.message)) {
        console.warn(`[loft] shelf diff non-retryable error at tol=${tol} for ${label}: ${e.message}`)
        return []
      }
    }
  }

  console.warn(`[loft] shelf diff failed after all retries for ${label}`)
  return []
}

// Compute polygon union with the same progressive-tolerance retry strategy.
// Returns { result, status } where status is one of:
//   'ok'             — succeeded at full precision (no data loss)
//   'retry:<tol>'    — succeeded after quantizing to <tol> (minor data loss ≈ tol)
//   'failed'         — all retries failed; result is fallbackA (caller's previous state)
function safeUnion(polyA, polyB, label, fallbackA) {
  const isRetryable = msg =>
    msg?.toLowerCase().includes('call stack') ||
    msg?.toLowerCase().includes('unable to complete output ring')

  try {
    return { result: polygonClipping.union(polyA, polyB), status: 'ok' }
  } catch (e0) {
    if (!isRetryable(e0.message)) {
      console.warn(`[union] non-retryable failure at ${label}: ${e0.message}`)
      return { result: fallbackA, status: 'failed' }
    }
  }

  for (const tol of [1e-5, 1e-4, 1e-3, 1e-2]) {
    try {
      const a = simplifyMultiPoly(polyA, tol) ?? polyA
      const b = simplifyMultiPoly(polyB, tol) ?? polyB
      const result = polygonClipping.union(a, b)
      console.warn(`[union] retry succeeded at tol=${tol} for ${label}`)
      return { result, status: `retry:${tol}` }
    } catch (e) {
      if (!isRetryable(e.message)) {
        console.warn(`[union] non-retryable error at tol=${tol} for ${label}: ${e.message}`)
        return { result: fallbackA, status: 'failed' }
      }
    }
  }

  console.warn(`[union] all retries failed at ${label}`)
  return { result: fallbackA, status: 'failed' }
}

/**
 * STEP 1c — Staircase loft: build a watertight BufferGeometry directly from
 * the accumulated (monotone-nested) contour stack.
 *
 * Algorithm:
 *   – Bottom cap  : triangulate first slab's polygon facing -dir
 *   – Per slab    : vertical wall quads around every ring (outer + holes)
 *   – Per shelf   : polygon-difference of adjacent slabs, triangulated facing +dir
 *   – Top cap     : triangulate last slab's polygon facing +dir
 *
 * Cost: O(N · V log V)  — pure polygon ops, no CSG, no voxelization.
 * Requires accumulateContours() to have been called (mergedSlices must carry poly).
 */
export function loftContoursToMesh(contour) {
  const { mergedSlices, lx, ly, stats } = contour
  if (!mergedSlices?.length) throw new Error('No merged slices. Run extractContour then accumulateContours first.')
  if (!mergedSlices[0].poly) throw new Error('mergedSlices missing poly field — please re-run Extract Contour.')

  const dir3 = new THREE.Vector3().crossVectors(lx, ly).normalize()
  const layerHeight = stats.layerHeight

  // Cache basis components for the hot-path
  const lxx = lx.x, lxy = lx.y, lxz = lx.z
  const lyx = ly.x, lyy = ly.y, lyz = ly.z
  const d3x = dir3.x, d3y = dir3.y, d3z = dir3.z

  // Use plain JS arrays for push(), convert to typed arrays at the end
  const positions = []
  const normals   = []

  // Aggregate counters so NOTHING fails silently
  const stats2 = {
    capsBottom:      0,
    capsTop:         0,
    capsGapBridge:   0,  // emitted when slabs are unconnected
    triUpShelf:      0,
    triDownShelf:    0,
    triWalls:        0,
    earcutZeroTris:  0,  // earcut returned 0 indices for non-empty input
    earcutRevSaved:  0,  // reversed-ring retry succeeded
    sliverSkips:     0,  // |signed area| < 1e-8 — silently skipped slivers
    badWindingFix:   0,  // outer ring with negative area, auto-reversed
    degenerateEdges: 0,  // wall edge with |outward normal| < 1e-10
    shortRings:      0,  // ring with <3 vertices
    gapsBridged:     0,
  }

  // Emit one vertex given 2D coords (px,py) in the lx/ly plane at sweep-axis height h
  function pushV(px, py, h) {
    positions.push(
      h*d3x + px*lxx + py*lyx,
      h*d3y + px*lxy + py*lyy,
      h*d3z + px*lxz + py*lyz
    )
  }

  // Compute signed area of a (possibly closed) ring in the lx/ly plane
  function ringSignedArea(ring) {
    const rlen = ring.length
    if (rlen < 3) return 0
    const closed = ring[0][0] === ring[rlen-1][0] && ring[0][1] === ring[rlen-1][1]
    const n = closed ? rlen - 1 : rlen
    let a = 0
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      a += ring[i][0] * ring[j][1] - ring[j][0] * ring[i][1]
    }
    return 0.5 * a
  }

  // ── Cap triangulation ─────────────────────────────────────────────────────
  // normalSign: +1 → faces +dir3 (top cap / ceiling of a recess)
  //             -1 → faces -dir3 (bottom cap / underside of a ledge)
  // Returns the number of triangles emitted.
  function triangulateCap(multiPoly, h, normalSign, label) {
    const nx = normalSign * d3x
    const ny = normalSign * d3y
    const nz = normalSign * d3z
    let triEmitted = 0
    for (let pIdx = 0; pIdx < multiPoly.length; pIdx++) {
      const polygon = multiPoly[pIdx]
      if (!polygon?.length) continue
      let outer = polygon[0]
      if (!outer || outer.length < 3) { stats2.shortRings++; continue }

      // Validate outer ring winding: polygon-clipping returns CCW outer,
      // but caller could pass arbitrary input — auto-fix if reversed.
      const outerArea = ringSignedArea(outer)
      if (outerArea < 0) {
        outer = outer.slice().reverse()
        stats2.badWindingFix++
        if (label) console.warn(`[loft] ${label} polygon[${pIdx}] outer had CW winding (area=${outerArea.toFixed(6)}) — auto-reversed`)
      }

      // Build flat earcut input. polygon-clipping rings are closed (first == last) — drop last.
      const verts = []
      const holeIdxs = []

      const olen = outer.length
      const outerClosed = olen > 1 && outer[0][0] === outer[olen-1][0] && outer[0][1] === outer[olen-1][1]
      for (let i = 0; i < (outerClosed ? olen - 1 : olen); i++) verts.push(outer[i][0], outer[i][1])

      for (let hi = 1; hi < polygon.length; hi++) {
        let hole = polygon[hi]
        if (!hole || hole.length < 3) { stats2.shortRings++; continue }
        // Holes should be CW (negative area) — fix if not
        const holeArea = ringSignedArea(hole)
        if (holeArea > 0) {
          hole = hole.slice().reverse()
          stats2.badWindingFix++
        }
        holeIdxs.push(verts.length >> 1)
        const hlen = hole.length
        const holeClosed = hlen > 1 && hole[0][0] === hole[hlen-1][0] && hole[0][1] === hole[hlen-1][1]
        for (let i = 0; i < (holeClosed ? hlen - 1 : hlen); i++) verts.push(hole[i][0], hole[i][1])
      }

      if (verts.length < 6) { stats2.shortRings++; continue }

      // Pre-filter degenerate/zero-area polygons.  polygon-clipping.difference()
      // can return collinear-vertex slivers when two contours barely differ.
      const nv2 = verts.length >> 1
      let a2 = 0
      for (let k = 0; k < nv2; k++) {
        const k2 = k * 2, j2 = ((k + 1) % nv2) * 2
        a2 += verts[k2] * verts[j2 + 1] - verts[j2] * verts[k2 + 1]
      }
      if (Math.abs(a2) < 1e-8) {
        stats2.sliverSkips++
        continue
      }

      let indices = earcut(verts, holeIdxs.length > 0 ? holeIdxs : null)

      // Earcut sometimes fails on otherwise-valid input due to subtle winding/
      // self-touching issues.  Retry with the outer ring reversed (and adjust
      // hole indices accordingly).
      if (indices.length === 0) {
        const outerVertCount = (outerClosed ? olen - 1 : olen)
        const revVerts = []
        for (let i = outerVertCount - 1; i >= 0; i--) {
          revVerts.push(verts[i * 2], verts[i * 2 + 1])
        }
        for (let i = outerVertCount * 2; i < verts.length; i++) revVerts.push(verts[i])
        indices = earcut(revVerts, holeIdxs.length > 0 ? holeIdxs : null)
        if (indices.length > 0) {
          stats2.earcutRevSaved++
          // Use reversed verts for the rest of this iteration; flip normalSign
          // contribution by swapping b/c below. We only need to read coords.
          for (let i = 0; i < verts.length; i++) verts[i] = revVerts[i]
        }
      }

      if (indices.length === 0) {
        stats2.earcutZeroTris++
        if (label) console.warn(`[loft] earcut=0 (after retry) for ${label} polygon[${pIdx}] — pts=${nv2} holes=${polygon.length-1} area2=${a2.toFixed(6)}`)
        continue
      }

      for (let t = 0; t < indices.length; t += 3) {
        const ia = indices[t]
        const ib = normalSign > 0 ? indices[t+1] : indices[t+2]
        const ic = normalSign > 0 ? indices[t+2] : indices[t+1]
        pushV(verts[ia*2], verts[ia*2+1], h)
        pushV(verts[ib*2], verts[ib*2+1], h)
        pushV(verts[ic*2], verts[ic*2+1], h)
        normals.push(nx,ny,nz, nx,ny,nz, nx,ny,nz)
        triEmitted++
      }
    }
    return triEmitted
  }

  // ── Vertical wall quads ───────────────────────────────────────────────────
  // For an outer ring (CCW): outward normal = (dy*lx − dx*ly).normalize()
  // For a hole ring  (CW) : outward normal = −(dy*lx − dx*ly).normalize()
  function generateWalls(ring, hLow, hHigh) {
    const rlen = ring.length
    if (rlen < 3) { stats2.shortRings++; return }
    const closed = ring[0][0] === ring[rlen-1][0] && ring[0][1] === ring[rlen-1][1]
    const n = closed ? rlen - 1 : rlen

    let area2 = 0
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      area2 += ring[i][0] * ring[j][1] - ring[j][0] * ring[i][1]
    }
    const isCCW = area2 > 0

    for (let i = 0; i < n; i++) {
      const [ax, ay] = ring[i]
      const [bx, by] = ring[(i + 1) % n]
      const dx = bx - ax, dy = by - ay
      const sign = isCCW ? 1 : -1
      const wx = sign*(dy*lxx - dx*lyx)
      const wy = sign*(dy*lxy - dx*lyy)
      const wz = sign*(dy*lxz - dx*lyz)
      const wl = Math.sqrt(wx*wx + wy*wy + wz*wz)
      if (wl < 1e-10) { stats2.degenerateEdges++; continue }
      const invWl = 1 / wl
      const wnx = wx*invWl, wny = wy*invWl, wnz = wz*invWl

      if (isCCW) {
        pushV(ax,ay,hLow);  pushV(bx,by,hLow);  pushV(bx,by,hHigh)
        normals.push(wnx,wny,wnz, wnx,wny,wnz, wnx,wny,wnz)
        pushV(ax,ay,hLow);  pushV(bx,by,hHigh); pushV(ax,ay,hHigh)
        normals.push(wnx,wny,wnz, wnx,wny,wnz, wnx,wny,wnz)
      } else {
        pushV(ax,ay,hLow);  pushV(bx,by,hHigh); pushV(bx,by,hLow)
        normals.push(wnx,wny,wnz, wnx,wny,wnz, wnx,wny,wnz)
        pushV(ax,ay,hLow);  pushV(ax,ay,hHigh); pushV(bx,by,hHigh)
        normals.push(wnx,wny,wnz, wnx,wny,wnz, wnx,wny,wnz)
      }
      stats2.triWalls += 2
    }
  }

  // ── Main staircase loop ───────────────────────────────────────────────────
  // Detect gaps and SYNTHESIZE bridge slabs that fill them with a polygon equal
  // to the union of the two neighbors' polys.  Because accumulated profiles are
  // monotone, the next slab's poly already ⊇ this slab's poly, so:
  //   bridge.poly = union(slab[i].poly, slab[i+1].poly) = slab[i+1].poly
  // (or, if accumulate didn't run, we union them defensively).  This keeps
  // walls continuous through the gap instead of inserting horizontal scar caps.
  const workingSlabs = []
  for (let i = 0; i < mergedSlices.length; i++) {
    workingSlabs.push(mergedSlices[i])
    if (i + 1 < mergedSlices.length) {
      const gap = mergedSlices[i + 1].planeDStart - mergedSlices[i].planeDEnd
      if (gap > layerHeight * 1.1) {
        // Build bridge poly = union of the two neighbors (defensive — usually
        // == next.poly when accumulate ran).
        let bridgePoly
        try {
          bridgePoly = polygonClipping.union(mergedSlices[i].poly, mergedSlices[i + 1].poly)
        } catch (e) {
          console.warn(`[loft] bridge union slab${i}→${i+1} failed (${e.message}); using next slab's poly as fallback`)
          bridgePoly = mergedSlices[i + 1].poly
        }
        workingSlabs.push({
          planeDStart: mergedSlices[i].planeDEnd + layerHeight * 0.5,
          planeDEnd:   mergedSlices[i + 1].planeDStart - layerHeight * 0.5,
          poly:        bridgePoly,
          shapes:      mergedSlices[i + 1].shapes,
          signature:   '__bridge__' + i,
          __bridge:    true,
        })
        console.warn(`[loft] gap slab${i}→${i+1} (gap=${gap.toFixed(3)}) filled by BRIDGE slab spanning ${(mergedSlices[i].planeDEnd + layerHeight*0.5).toFixed(3)}…${(mergedSlices[i + 1].planeDStart - layerHeight*0.5).toFixed(3)} — walls remain continuous`)
        stats2.gapsBridged++
      }
    }
  }

  const slabs = workingSlabs

  const hBottom = slabs[0].planeDStart - layerHeight * 0.5

  // Bottom cap (faces -dir3)
  stats2.capsBottom = triangulateCap(slabs[0].poly, hBottom, -1, 'bottom-cap')

  let shelfsMissing = 0
  let shelfsGenerated = 0

  for (let i = 0; i < slabs.length; i++) {
    const slab = slabs[i]
    const hLow  = slab.planeDStart - layerHeight * 0.5
    const hHigh = slab.planeDEnd   + layerHeight * 0.5

    // Vertical walls for every ring (outer boundary + holes)
    for (const polygon of slab.poly) {
      if (!polygon?.length) continue
      for (const ring of polygon) {
        if (ring.length >= 3) generateWalls(ring, hLow, hHigh)
        else stats2.shortRings++
      }
    }

    // Shelf at the top interface with the next slab.
    if (i + 1 < slabs.length) {
      const nextPoly = slabs[i + 1].poly
      const zLabel   = `slab${i}→${i+1} z=${hHigh.toFixed(3)}`

      const upShelf = safeDifference(nextPoly, slab.poly, `up ${zLabel}`)
      if (upShelf.length > 0) {
        const n = triangulateCap(upShelf, hHigh, -1, `upShelf ${zLabel}`)
        stats2.triUpShelf += n
        if (n > 0) shelfsGenerated++
        else { console.warn(`[loft] upShelf at ${zLabel}: difference returned ${upShelf.length} polygon(s) but produced 0 triangles`); shelfsMissing++ }
      }

      const downShelf = safeDifference(slab.poly, nextPoly, `down ${zLabel}`)
      if (downShelf.length > 0) {
        const n = triangulateCap(downShelf, hHigh, +1, `downShelf ${zLabel}`)
        stats2.triDownShelf += n
      }
    }
  }

  if (shelfsMissing > 0) console.warn(`[loft] ${shelfsMissing} shelf(ves) missing/degenerate out of ${slabs.length - 1} expected transitions`)
  console.log(`[loft] ${shelfsGenerated}/${slabs.length - 1} shelf transitions generated (${stats2.gapsBridged} gaps bridged)`)

  // Top cap (faces +dir3)
  const last = slabs[slabs.length - 1]
  const hTop = last.planeDEnd + layerHeight * 0.5
  stats2.capsTop = triangulateCap(last.poly, hTop, +1, 'top-cap')

  const posArr = new Float32Array(positions)
  const norArr = new Float32Array(normals)

  const geom = new THREE.BufferGeometry()
  geom.setAttribute('position', new THREE.BufferAttribute(posArr, 3))
  geom.setAttribute('normal',   new THREE.BufferAttribute(norArr, 3))

  const triCount = posArr.length / 9

  // ── Final aggregate report so EVERY drop is visible ─────────────────────
  console.groupCollapsed(`[loft] BUILD SUMMARY — ${triCount} triangles`)
  console.table({
    'caps bottom':         stats2.capsBottom,
    'caps top':            stats2.capsTop,
    'gap bridges (slabs)': stats2.gapsBridged,
    'wall triangles':      stats2.triWalls,
    'up-shelf triangles':  stats2.triUpShelf,
    'down-shelf triangles':stats2.triDownShelf,
    'shelves generated':   shelfsGenerated,
    'shelves missing':     shelfsMissing,
    'sliver skips':        stats2.sliverSkips,
    'earcut=0 (lost)':     stats2.earcutZeroTris,
    'earcut saved by reverse': stats2.earcutRevSaved,
    'winding auto-fixed':  stats2.badWindingFix,
    'degenerate edges':    stats2.degenerateEdges,
    'short rings (<3)':    stats2.shortRings,
  })
  console.groupEnd()

  if (triCount === 0) {
    throw new Error(
      `loftContoursToMesh: produced 0 triangles. ` +
      `mergedSlices=${mergedSlices.length}, sliverSkips=${stats2.sliverSkips}, ` +
      `earcutZeroTris=${stats2.earcutZeroTris}, shortRings=${stats2.shortRings}. ` +
      `Check console summary for details.`
    )
  }
  if (stats2.earcutZeroTris > 0) {
    console.warn(`[loft] WARNING: ${stats2.earcutZeroTris} polygon(s) failed triangulation even after reversal — mesh may have small holes`)
  }

  console.log(`[loft] ${triCount} triangles, ${posArr.length / 3} vertices`)
  return geom
}

